import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  scheduledNotifications,
  upcomingMovies,
  trackedSeries,
  trackedEpisodes,
  users,
  notificationSettings,
  notificationLog,
  notificationConfig,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, and, isNull, or, inArray } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import {
  formatAnnouncementMessage,
  formatTheatricalReleaseMessage,
  formatDigitalReleaseMessage,
  formatSeasonAnnouncementMessage,
  formatEpisodeReleaseMessage,
  type MovieNotificationData,
  type SeriesNotificationData,
} from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;

// Moscow timezone offset (UTC+3)
const MSK_OFFSET_HOURS = 3;

// Silent hours (23:00-08:00 MSK = 20:00-05:00 UTC)
const SILENT_HOUR_START_UTC = 20;
const SILENT_HOUR_END_UTC = 5;

function isSilentHours(): boolean {
  const hourUtc = new Date().getUTCHours();
  return hourUtc >= SILENT_HOUR_START_UTC || hourUtc < SILENT_HOUR_END_UTC;
}

export async function GET(request: NextRequest) {
  return handleSendScheduled(request);
}

export async function POST(request: NextRequest) {
  return handleSendScheduled(request);
}

async function handleSendScheduled(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slotMinute = parseInt(searchParams.get('slot') || '0', 10);

  try {
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const now = new Date();
    const currentHour = now.getUTCHours();
    const today = now.toISOString().split('T')[0];

    // Get pending notifications for current slot
    const pendingNotifications = await db
      .select()
      .from(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.scheduledDate, today),
          eq(scheduledNotifications.scheduledHour, currentHour),
          eq(scheduledNotifications.scheduledMinute, slotMinute),
          eq(scheduledNotifications.status, 'pending')
        )
      )
      .limit(5); // Process max 5 per run to avoid timeout

    if (pendingNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No notifications scheduled for this slot',
        results,
        slot: { date: today, hour: currentHour, minute: slotMinute },
        timestamp: new Date().toISOString(),
      });
    }

    // Get admin mode config
    const config = await getPublicModeConfig();
    const silentMode = isSilentHours();
    const bot = getBot();

    for (const notification of pendingNotifications) {
      results.processed++;

      // Mark as sending
      await db
        .update(scheduledNotifications)
        .set({ status: 'sending', updatedAt: new Date() })
        .where(eq(scheduledNotifications.id, notification.id));

      try {
        const sendResult = await sendNotification(notification, config, silentMode, bot);

        // Update notification status
        await db
          .update(scheduledNotifications)
          .set({
            status: 'sent',
            sentAt: new Date(),
            successCount: sendResult.successCount,
            failureCount: sendResult.failureCount,
            updatedAt: new Date(),
          })
          .where(eq(scheduledNotifications.id, notification.id));

        // Mark source as notified
        await markAsNotified(notification);

        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${notification.type} tmdbId=${notification.tmdbId}: ${String(error)}`);

        await db
          .update(scheduledNotifications)
          .set({
            status: 'failed',
            errorDetails: String(error),
            updatedAt: new Date(),
          })
          .where(eq(scheduledNotifications.id, notification.id));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} notifications`,
      results,
      slot: { date: today, hour: currentHour, minute: slotMinute },
      silentMode,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send scheduled error:', error);
    return NextResponse.json(
      { error: 'Failed to send scheduled notifications', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================
// Helper functions
// ============================================

async function getPublicModeConfig() {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, ['upcoming.publicEnabled', 'upcoming.adminTelegramIds'])
    );

  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  const adminIdsStr = configMap.get('upcoming.adminTelegramIds') || '';
  const adminTelegramIds = adminIdsStr
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  return {
    publicEnabled: configMap.get('upcoming.publicEnabled') === 'true',
    adminTelegramIds,
  };
}

async function getTargetUsers(
  notificationType: string,
  config: { publicEnabled: boolean; adminTelegramIds: number[] }
) {
  // Map notification type to setting column
  const settingColumn = {
    [NOTIFICATION_TYPE.ANNOUNCEMENT]: 'upcomingAnnouncements',
    [NOTIFICATION_TYPE.THEATRICAL_RELEASE]: 'upcomingTheatricalReleases',
    [NOTIFICATION_TYPE.DIGITAL_RELEASE]: 'upcomingDigitalReleases',
    [NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT]: 'seriesSeasons',
    [NOTIFICATION_TYPE.EPISODE_RELEASE]: 'seriesEpisodes',
  }[notificationType] as keyof typeof notificationSettings.$inferSelect;

  if (!config.publicEnabled) {
    // Admin-only mode
    if (config.adminTelegramIds.length === 0) {
      return [];
    }

    return db
      .select({
        id: users.id,
        telegramId: users.telegramId,
        languageCode: users.languageCode,
      })
      .from(users)
      .where(inArray(users.telegramId, config.adminTelegramIds));
  }

  // Public mode - get users with notification enabled
  return db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      languageCode: users.languageCode,
    })
    .from(users)
    .leftJoin(notificationSettings, eq(users.id, notificationSettings.userId))
    .where(
      or(
        isNull(notificationSettings[settingColumn]),
        eq(notificationSettings[settingColumn], true)
      )
    );
}

async function sendNotification(
  notification: typeof scheduledNotifications.$inferSelect,
  config: { publicEnabled: boolean; adminTelegramIds: number[] },
  silentMode: boolean,
  bot: ReturnType<typeof getBot>
) {
  // Get content data
  const contentData = await getNotificationContent(notification);
  if (!contentData) {
    throw new Error('Content not found');
  }

  // Get target users
  const targetUsers = await getTargetUsers(notification.type, config);
  if (targetUsers.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Create log entry
  const [logEntry] = await db
    .insert(notificationLog)
    .values({
      type: notification.type,
      upcomingMovieId: notification.upcomingMovieId,
      trackedSeriesId: notification.trackedSeriesId,
      tmdbId: notification.tmdbId,
      totalRecipients: targetUsers.length,
    })
    .returning();

  let successCount = 0;
  let failureCount = 0;

  // Send in batches
  for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
    const batch = targetUsers.slice(i, i + BATCH_SIZE);

    const sendPromises = batch.map(async (user) => {
      try {
        const isRussian = user.languageCode === 'ru';
        const message = formatMessage(notification.type, contentData, isRussian);

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
      } catch {
        return { success: false };
      }
    });

    const batchResults = await Promise.all(sendPromises);

    for (const result of batchResults) {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
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
    })
    .where(eq(notificationLog.id, logEntry.id));

  return { successCount, failureCount };
}

async function getNotificationContent(
  notification: typeof scheduledNotifications.$inferSelect
): Promise<MovieNotificationData | SeriesNotificationData | null> {
  switch (notification.type) {
    case NOTIFICATION_TYPE.ANNOUNCEMENT:
    case NOTIFICATION_TYPE.THEATRICAL_RELEASE:
    case NOTIFICATION_TYPE.DIGITAL_RELEASE: {
      if (!notification.upcomingMovieId) return null;
      const [movie] = await db
        .select()
        .from(upcomingMovies)
        .where(eq(upcomingMovies.id, notification.upcomingMovieId));
      if (!movie) return null;
      return {
        title: movie.title,
        titleRu: movie.titleRu,
        posterPath: movie.posterPath,
        overview: movie.overview,
        overviewRu: movie.overviewRu,
        tmdbId: movie.tmdbId,
        theatricalReleaseRu: movie.theatricalReleaseRu ? new Date(movie.theatricalReleaseRu) : null,
        theatricalReleaseUs: movie.theatricalReleaseUs ? new Date(movie.theatricalReleaseUs) : null,
      };
    }

    case NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT: {
      if (!notification.trackedSeriesId) return null;
      const [series] = await db
        .select()
        .from(trackedSeries)
        .where(eq(trackedSeries.id, notification.trackedSeriesId));
      if (!series) return null;
      return {
        title: series.title,
        titleRu: series.titleRu,
        posterPath: series.posterPath,
        tmdbId: series.tmdbId,
        seasonNumber: series.currentSeasons,
      };
    }

    case NOTIFICATION_TYPE.EPISODE_RELEASE: {
      if (!notification.trackedEpisodeId || !notification.trackedSeriesId) return null;
      const [episode] = await db
        .select()
        .from(trackedEpisodes)
        .where(eq(trackedEpisodes.id, notification.trackedEpisodeId));
      const [series] = await db
        .select()
        .from(trackedSeries)
        .where(eq(trackedSeries.id, notification.trackedSeriesId));
      if (!episode || !series) return null;
      return {
        title: series.title,
        titleRu: series.titleRu,
        posterPath: series.posterPath,
        tmdbId: series.tmdbId,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.episodeName,
      };
    }

    default:
      return null;
  }
}

function formatMessage(
  type: string,
  content: MovieNotificationData | SeriesNotificationData,
  isRussian: boolean
) {
  switch (type) {
    case NOTIFICATION_TYPE.ANNOUNCEMENT:
      return formatAnnouncementMessage(content as MovieNotificationData, isRussian);
    case NOTIFICATION_TYPE.THEATRICAL_RELEASE:
      return formatTheatricalReleaseMessage(content as MovieNotificationData, isRussian);
    case NOTIFICATION_TYPE.DIGITAL_RELEASE:
      return formatDigitalReleaseMessage(content as MovieNotificationData, isRussian);
    case NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT:
      return formatSeasonAnnouncementMessage(content as SeriesNotificationData, isRussian);
    case NOTIFICATION_TYPE.EPISODE_RELEASE:
      return formatEpisodeReleaseMessage(content as SeriesNotificationData, isRussian);
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

async function markAsNotified(notification: typeof scheduledNotifications.$inferSelect) {
  const now = new Date();

  switch (notification.type) {
    case NOTIFICATION_TYPE.ANNOUNCEMENT:
      if (notification.upcomingMovieId) {
        await db
          .update(upcomingMovies)
          .set({ announcementSentAt: now, updatedAt: now })
          .where(eq(upcomingMovies.id, notification.upcomingMovieId));
      }
      break;

    case NOTIFICATION_TYPE.THEATRICAL_RELEASE:
      if (notification.upcomingMovieId) {
        await db
          .update(upcomingMovies)
          .set({ theatricalReleaseSentAt: now, status: 'released', updatedAt: now })
          .where(eq(upcomingMovies.id, notification.upcomingMovieId));
      }
      break;

    case NOTIFICATION_TYPE.DIGITAL_RELEASE:
      if (notification.upcomingMovieId) {
        await db
          .update(upcomingMovies)
          .set({ digitalReleaseSentAt: now, updatedAt: now })
          .where(eq(upcomingMovies.id, notification.upcomingMovieId));
      }
      break;

    case NOTIFICATION_TYPE.SEASON_ANNOUNCEMENT:
      if (notification.trackedSeriesId) {
        await db
          .update(trackedSeries)
          .set({
            seasonAnnouncementSentAt: now,
            lastKnownSeasons: trackedSeries.currentSeasons,
            updatedAt: now
          })
          .where(eq(trackedSeries.id, notification.trackedSeriesId));
      }
      break;

    case NOTIFICATION_TYPE.EPISODE_RELEASE:
      if (notification.trackedEpisodeId) {
        await db
          .update(trackedEpisodes)
          .set({ notificationSentAt: now })
          .where(eq(trackedEpisodes.id, notification.trackedEpisodeId));
      }
      break;
  }
}
