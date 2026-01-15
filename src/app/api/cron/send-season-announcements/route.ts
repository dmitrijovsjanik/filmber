import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  trackedSeries,
  users,
  userMovieLists,
  movies,
  notificationSettings,
  notificationLog,
  notificationConfig,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, or, and, inArray, isNotNull } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { formatSeasonAnnouncementMessage } from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;

// Silent hours in Moscow timezone (UTC+3)
// From 23:00 to 08:00 MSK = 20:00 to 05:00 UTC
const SILENT_HOUR_START_UTC = 20;
const SILENT_HOUR_END_UTC = 5;

/**
 * Check if current time is in silent hours (23:00 - 08:00 MSK)
 */
function isSilentHours(): boolean {
  const nowUtc = new Date();
  const hourUtc = nowUtc.getUTCHours();
  return hourUtc >= SILENT_HOUR_START_UTC || hourUtc < SILENT_HOUR_END_UTC;
}

export async function GET(request: NextRequest) {
  return handleSendSeasonAnnouncements(request);
}

export async function POST(request: NextRequest) {
  return handleSendSeasonAnnouncements(request);
}

async function handleSendSeasonAnnouncements(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      seriesProcessed: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: [] as string[],
    };

    // Check silent hours - skip entirely during quiet time
    if (isSilentHours()) {
      return NextResponse.json({
        success: true,
        message: 'Skipped: Silent hours (23:00-08:00 MSK)',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    // Get configuration
    const config = await getSeriesConfig();

    // Get series with new season detected but not announced yet
    const seriesToAnnounce = await db
      .select()
      .from(trackedSeries)
      .where(
        and(
          isNotNull(trackedSeries.newSeasonDetectedAt),
          isNull(trackedSeries.seasonAnnouncementSentAt),
          eq(trackedSeries.trackingStatus, 'active')
        )
      )
      .limit(1); // Process only 1 series per hour

    if (seriesToAnnounce.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No series to announce',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    const series = seriesToAnnounce[0];

    // Get target users
    let targetUsers: { id: string; telegramId: number; languageCode: string | null }[];

    if (config.publicEnabled) {
      // Public mode: users who had this series in "watched" AND have series notifications enabled
      // Note: The series was already moved to "want_to_watch" by sync-series,
      // but we want to notify users who originally had it in "watched"
      targetUsers = await db
        .select({
          id: users.id,
          telegramId: users.telegramId,
          languageCode: users.languageCode,
        })
        .from(users)
        .innerJoin(userMovieLists, eq(users.id, userMovieLists.userId))
        .innerJoin(movies, eq(userMovieLists.unifiedMovieId, movies.id))
        .leftJoin(notificationSettings, eq(users.id, notificationSettings.userId))
        .where(
          and(
            eq(movies.tmdbId, series.tmdbId),
            // Include users regardless of current status (they may have just been moved to want_to_watch)
            or(
              eq(userMovieLists.status, 'watched'),
              eq(userMovieLists.status, 'want_to_watch')
            ),
            or(
              isNull(notificationSettings.seriesSeasonAnnouncements),
              eq(notificationSettings.seriesSeasonAnnouncements, true)
            )
          )
        );
    } else {
      // Admin-only mode
      if (config.adminTelegramIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Admin-only mode but no adminTelegramIds configured',
          config: { publicEnabled: config.publicEnabled },
          results,
          timestamp: new Date().toISOString(),
        });
      }

      const adminTelegramIdsNum = config.adminTelegramIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

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
      // No users to notify, mark as sent anyway
      await db
        .update(trackedSeries)
        .set({
          seasonAnnouncementSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trackedSeries.id, series.id));

      return NextResponse.json({
        success: true,
        message: config.publicEnabled ? 'No users with series notifications enabled' : 'No admin users found',
        config: { publicEnabled: config.publicEnabled },
        results,
        timestamp: new Date().toISOString(),
      });
    }

    const bot = getBot();
    const silentMode = isSilentHours();

    results.seriesProcessed++;

    // Create log entry
    const [logEntry] = await db
      .insert(notificationLog)
      .values({
        type: NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT,
        trackedSeriesId: series.id,
        tmdbId: series.tmdbId,
        seasonNumber: series.currentSeasons,
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
          const message = formatSeasonAnnouncementMessage(
            {
              title: series.title,
              titleRu: series.titleRu,
              posterPath: series.posterPath,
              tmdbId: series.tmdbId,
              seasonNumber: series.currentSeasons,
            },
            isRussian
          );

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

    // Mark series as announced
    await db
      .update(trackedSeries)
      .set({
        seasonAnnouncementSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trackedSeries.id, series.id));

    return NextResponse.json({
      success: true,
      message: 'Season announcements sent',
      series: { title: series.title, season: series.currentSeasons },
      results,
      config: { publicEnabled: config.publicEnabled, silentMode },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send season announcements cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send season announcements', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get series notification configuration from database
 */
async function getSeriesConfig(): Promise<{
  publicEnabled: boolean;
  adminTelegramIds: string[];
}> {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, [
        'series.publicEnabled',
        'series.adminTelegramIds',
      ])
    );

  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  const adminIdsStr = configMap.get('series.adminTelegramIds') || '';
  const adminTelegramIds = adminIdsStr
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return {
    publicEnabled: configMap.get('series.publicEnabled') === 'true',
    adminTelegramIds,
  };
}
