import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  upcomingMovies,
  users,
  notificationSettings,
  notificationLog,
  notificationConfig,
  upcomingSyncStats,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, or, and, desc, inArray, lt } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { formatAnnouncementMessage } from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;

// Default configuration values
const DEFAULT_ANNOUNCE_MIN_POPULARITY = 20;
const DEFAULT_MIN_AGE_HOURS = 12; // Movies must "mature" before announcing

// Silent hours in Moscow timezone (UTC+3)
// From 23:00 to 08:00 MSK = 20:00 to 05:00 UTC
const SILENT_HOUR_START_UTC = 20; // 23:00 MSK
const SILENT_HOUR_END_UTC = 5; // 08:00 MSK

/**
 * Check if current time is in silent hours (23:00 - 08:00 MSK)
 */
function isSilentHours(): boolean {
  const nowUtc = new Date();
  const hourUtc = nowUtc.getUTCHours();

  // Silent from 20:00 UTC (23:00 MSK) to 05:00 UTC (08:00 MSK)
  return hourUtc >= SILENT_HOUR_START_UTC || hourUtc < SILENT_HOUR_END_UTC;
}

export async function GET(request: NextRequest) {
  return handleSendAnnouncements(request);
}

export async function POST(request: NextRequest) {
  return handleSendAnnouncements(request);
}

async function handleSendAnnouncements(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      moviesProcessed: 0,
      skipped: {
        tooYoung: 0,
        lowPopularity: 0,
        noRussian: 0,
        noPoster: 0,
      },
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: [] as string[],
    };

    // Get announcement configuration
    const config = await getAnnouncementConfig();
    const { announceMinPopularity, minAgeHours, publicEnabled, adminTelegramIds } = config;

    // Calculate cutoff time for "mature" movies
    const maturityCutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000);

    // Get movies that haven't had announcement sent yet
    const candidateMovies = await db
      .select()
      .from(upcomingMovies)
      .where(
        and(
          eq(upcomingMovies.status, 'tracked'),
          isNull(upcomingMovies.announcementSentAt),
          lt(upcomingMovies.discoveredAt, maturityCutoff) // Must be old enough
        )
      )
      .orderBy(desc(upcomingMovies.popularity))
      .limit(20); // Fetch more to filter

    // Filter movies that meet quality criteria
    const moviesToAnnounce = candidateMovies.filter((movie) => {
      const popularity = parseFloat(movie.popularity || '0');
      const hasRussian = movie.overviewRu && movie.overviewRu.length > 0;
      const hasPoster = movie.posterPath && movie.posterPath.length > 0;

      if (popularity < announceMinPopularity) {
        results.skipped.lowPopularity++;
        return false;
      }
      if (!hasRussian) {
        results.skipped.noRussian++;
        return false;
      }
      if (!hasPoster) {
        results.skipped.noPoster++;
        return false;
      }
      return true;
    }).slice(0, 1); // Process only 1 movie per hour (cron runs hourly)

    const totalSkipped = Object.values(results.skipped).reduce((a, b) => a + b, 0);

    if (moviesToAnnounce.length === 0) {
      return NextResponse.json({
        success: true,
        message: candidateMovies.length > 0
          ? `No movies meet quality criteria (${totalSkipped} skipped)`
          : 'No mature movies to announce',
        config: { announceMinPopularity, minAgeHours, publicEnabled },
        results,
        timestamp: new Date().toISOString(),
      });
    }

    // Get target users based on publicEnabled flag
    let targetUsers: { id: string; telegramId: number; languageCode: string | null }[];

    if (publicEnabled) {
      // Public mode: all users with announcements enabled
      targetUsers = await db
        .select({
          id: users.id,
          telegramId: users.telegramId,
          languageCode: users.languageCode,
        })
        .from(users)
        .leftJoin(notificationSettings, eq(users.id, notificationSettings.userId))
        .where(
          or(
            isNull(notificationSettings.upcomingAnnouncements),
            eq(notificationSettings.upcomingAnnouncements, true)
          )
        );
    } else {
      // Admin-only mode: only send to admin telegram IDs
      if (adminTelegramIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Admin-only mode but no adminTelegramIds configured',
          config: { announceMinPopularity, minAgeHours, publicEnabled },
          results,
          timestamp: new Date().toISOString(),
        });
      }

      // Convert string IDs to numbers for DB query
      const adminTelegramIdsNum = adminTelegramIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

      targetUsers = await db
        .select({
          id: users.id,
          telegramId: users.telegramId,
          languageCode: users.languageCode,
        })
        .from(users)
        .where(inArray(users.telegramId, adminTelegramIdsNum));
    }

    if (targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: publicEnabled
          ? 'No users with announcements enabled'
          : 'No admin users found',
        config: { announceMinPopularity, minAgeHours, publicEnabled },
        results,
        timestamp: new Date().toISOString(),
      });
    }

    const bot = getBot();

    // Check if we're in silent hours (23:00 - 08:00 MSK)
    const silentMode = isSilentHours();

    for (const movie of moviesToAnnounce) {
      results.moviesProcessed++;

      // Create log entry
      const [logEntry] = await db
        .insert(notificationLog)
        .values({
          type: NOTIFICATION_TYPE.ANNOUNCEMENT,
          upcomingMovieId: movie.id,
          tmdbId: movie.tmdbId,
          totalRecipients: targetUsers.length,
        })
        .returning();

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Send in batches
      for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
        const batch = targetUsers.slice(i, i + BATCH_SIZE);

        const sendPromises = batch.map(async (user) => {
          try {
            const isRussian = user.languageCode === 'ru';
            const message = formatAnnouncementMessage(movie, isRussian);

            if (message.photoUrl) {
              await bot.api.sendPhoto(user.telegramId, message.photoUrl, {
                caption: message.text,
                parse_mode: 'HTML',
                reply_markup: message.keyboard,
                disable_notification: silentMode,
              });
            } else {
              await bot.api.sendMessage(user.telegramId, message.text, {
                parse_mode: 'HTML',
                reply_markup: message.keyboard,
                disable_notification: silentMode,
              });
            }
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        });

        const batchResults = await Promise.all(sendPromises);

        for (const result of batchResults) {
          if (result.success) {
            successCount++;
            results.notificationsSent++;
          } else {
            failureCount++;
            results.notificationsFailed++;
            if (result.error) errors.push(result.error);
          }
        }

        // Delay between batches
        if (i + BATCH_SIZE < targetUsers.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // Update log entry
      await db
        .update(notificationLog)
        .set({
          successCount,
          failureCount,
          completedAt: new Date(),
          errorDetails: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        })
        .where(eq(notificationLog.id, logEntry.id));

      // Mark movie as announced
      await db
        .update(upcomingMovies)
        .set({
          announcementSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(upcomingMovies.id, movie.id));
    }

    // Record daily statistics
    await updateAnnouncementStats({
      announcedMovies: results.moviesProcessed,
      skippedLowPopularity: results.skipped.lowPopularity,
      skippedNoRussian: results.skipped.noRussian,
      skippedNoPoster: results.skipped.noPoster,
      notificationsSent: results.notificationsSent,
      notificationsFailed: results.notificationsFailed,
    });

    return NextResponse.json({
      success: true,
      message: 'Announcements sent',
      results,
      config: { announceMinPopularity, minAgeHours, publicEnabled, silentMode },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send announcements cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send announcements', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get announcement configuration from database
 */
async function getAnnouncementConfig(): Promise<{
  announceMinPopularity: number;
  minAgeHours: number;
  publicEnabled: boolean;
  adminTelegramIds: string[];
}> {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, [
        'upcoming.announceMinPopularity',
        'upcoming.minAgeHours',
        'upcoming.publicEnabled',
        'upcoming.adminTelegramIds',
      ])
    );

  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  // Parse admin telegram IDs (comma-separated string)
  const adminIdsStr = configMap.get('upcoming.adminTelegramIds') || '';
  const adminTelegramIds = adminIdsStr
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return {
    announceMinPopularity: parseInt(
      configMap.get('upcoming.announceMinPopularity') || String(DEFAULT_ANNOUNCE_MIN_POPULARITY),
      10
    ),
    minAgeHours: parseInt(
      configMap.get('upcoming.minAgeHours') || String(DEFAULT_MIN_AGE_HOURS),
      10
    ),
    publicEnabled: configMap.get('upcoming.publicEnabled') === 'true',
    adminTelegramIds,
  };
}

/**
 * Update daily announcement statistics (upsert)
 */
async function updateAnnouncementStats(stats: {
  announcedMovies: number;
  skippedLowPopularity: number;
  skippedNoRussian: number;
  skippedNoPoster: number;
  notificationsSent: number;
  notificationsFailed: number;
}) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Try to update existing record (add to existing counts)
    const existing = await db
      .select()
      .from(upcomingSyncStats)
      .where(eq(upcomingSyncStats.date, today))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(upcomingSyncStats)
        .set({
          announcedMovies: existing[0].announcedMovies + stats.announcedMovies,
          skippedLowPopularity: existing[0].skippedLowPopularity + stats.skippedLowPopularity,
          skippedNoRussian: existing[0].skippedNoRussian + stats.skippedNoRussian,
          skippedNoPoster: existing[0].skippedNoPoster + stats.skippedNoPoster,
          notificationsSent: existing[0].notificationsSent + stats.notificationsSent,
          notificationsFailed: existing[0].notificationsFailed + stats.notificationsFailed,
          updatedAt: new Date(),
        })
        .where(eq(upcomingSyncStats.date, today));
    } else {
      await db.insert(upcomingSyncStats).values({
        date: today,
        ...stats,
      });
    }
  } catch (error) {
    console.error('Failed to update announcement stats:', error);
  }
}
