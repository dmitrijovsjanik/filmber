import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  trackedSeries,
  trackedEpisodes,
  users,
  userMovieLists,
  movies,
  notificationSettings,
  notificationLog,
  notificationConfig,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, or, and, inArray, lte } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { formatEpisodeReleaseMessage } from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;
const DEFAULT_MAX_EPISODES_PER_HOUR = 3;

// Silent hours in Moscow timezone (UTC+3)
const SILENT_HOUR_START_UTC = 20;
const SILENT_HOUR_END_UTC = 5;

function isSilentHours(): boolean {
  const nowUtc = new Date();
  const hourUtc = nowUtc.getUTCHours();
  return hourUtc >= SILENT_HOUR_START_UTC || hourUtc < SILENT_HOUR_END_UTC;
}

export async function GET(request: NextRequest) {
  return handleSendEpisodeReleases(request);
}

export async function POST(request: NextRequest) {
  return handleSendEpisodeReleases(request);
}

async function handleSendEpisodeReleases(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      episodesProcessed: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: [] as string[],
    };

    // Check silent hours
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

    const today = new Date().toISOString().split('T')[0];

    // Get episodes ready to notify (notifyDate <= today AND not sent)
    const episodesToNotify = await db
      .select({
        episode: trackedEpisodes,
        series: trackedSeries,
      })
      .from(trackedEpisodes)
      .innerJoin(trackedSeries, eq(trackedEpisodes.trackedSeriesId, trackedSeries.id))
      .where(
        and(
          lte(trackedEpisodes.notifyDate, today),
          isNull(trackedEpisodes.notificationSentAt),
          eq(trackedSeries.trackingStatus, 'active')
        )
      )
      .limit(config.maxEpisodesPerHour);

    if (episodesToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No episodes to notify',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    const bot = getBot();
    const silentMode = isSilentHours();

    for (const { episode, series } of episodesToNotify) {
      results.episodesProcessed++;

      // Get target users
      let targetUsers: { id: string; telegramId: number; languageCode: string | null }[];

      if (config.publicEnabled) {
        // Public mode: users who have this series in their list AND have episode notifications enabled
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
              or(
                isNull(notificationSettings.seriesEpisodeReleases),
                eq(notificationSettings.seriesEpisodeReleases, true)
              )
            )
          );
      } else {
        // Admin-only mode
        if (config.adminTelegramIds.length === 0) {
          // Mark as sent to avoid re-processing
          await db
            .update(trackedEpisodes)
            .set({ notificationSentAt: new Date() })
            .where(eq(trackedEpisodes.id, episode.id));
          continue;
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
        // No users to notify, mark as sent
        await db
          .update(trackedEpisodes)
          .set({ notificationSentAt: new Date() })
          .where(eq(trackedEpisodes.id, episode.id));
        continue;
      }

      // Create log entry
      const [logEntry] = await db
        .insert(notificationLog)
        .values({
          type: NOTIFICATION_TYPE.EPISODE_RELEASE,
          trackedSeriesId: series.id,
          tmdbId: series.tmdbId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
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
            const message = formatEpisodeReleaseMessage(
              {
                title: series.title,
                titleRu: series.titleRu,
                posterPath: series.posterPath,
                tmdbId: series.tmdbId,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.episodeNumber,
                episodeName: episode.episodeName,
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

      // Mark episode as notified
      await db
        .update(trackedEpisodes)
        .set({ notificationSentAt: new Date() })
        .where(eq(trackedEpisodes.id, episode.id));
    }

    return NextResponse.json({
      success: true,
      message: 'Episode releases sent',
      results,
      config: { publicEnabled: config.publicEnabled, maxEpisodesPerHour: config.maxEpisodesPerHour, silentMode },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send episode releases cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send episode releases', details: String(error) },
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
  maxEpisodesPerHour: number;
}> {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, [
        'series.publicEnabled',
        'series.adminTelegramIds',
        'series.maxEpisodesPerHour',
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
    maxEpisodesPerHour: parseInt(configMap.get('series.maxEpisodesPerHour') || String(DEFAULT_MAX_EPISODES_PER_HOUR), 10),
  };
}
