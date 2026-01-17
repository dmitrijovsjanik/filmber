import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  trackedSeries,
  trackedEpisodes,
  userMovieLists,
  movies,
  notificationConfig,
} from '@/lib/db/schema';
import { eq, and, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { tmdb } from '@/lib/api/tmdb';

const CRON_SECRET = process.env.CRON_SECRET;

// Default configuration
const DEFAULT_EPISODE_DELAY_DAYS = 7;

interface SyncResult {
  newSeries: number;
  updatedSeries: number;
  newSeasons: number;
  newEpisodes: number;
  archivedSeries: number;
  statusChanges: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results: SyncResult = {
      newSeries: 0,
      updatedSeries: 0,
      newSeasons: 0,
      newEpisodes: 0,
      archivedSeries: 0,
      statusChanges: 0,
      errors: [],
    };

    // Get configuration
    const config = await getSeriesConfig();
    if (!config.syncEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Series sync is disabled',
        timestamp: new Date().toISOString(),
      });
    }

    // Step 1: Get all unique TV series with status 'watched' from user lists
    const watchedSeries = await db
      .select({
        tmdbId: movies.tmdbId,
        unifiedMovieId: movies.id,
        title: movies.title,
        titleRu: movies.titleRu,
        posterPath: movies.posterPath,
      })
      .from(userMovieLists)
      .innerJoin(movies, eq(userMovieLists.unifiedMovieId, movies.id))
      .where(
        and(
          eq(userMovieLists.status, 'watched'),
          eq(movies.mediaType, 'tv'),
          isNotNull(movies.tmdbId)
        )
      )
      .groupBy(movies.id);

    // Deduplicate by tmdbId
    const uniqueSeries = new Map<number, (typeof watchedSeries)[0]>();
    for (const series of watchedSeries) {
      if (series.tmdbId && !uniqueSeries.has(series.tmdbId)) {
        uniqueSeries.set(series.tmdbId, series);
      }
    }

    // Get existing tracked series
    const existingTracked = await db
      .select({ tmdbId: trackedSeries.tmdbId })
      .from(trackedSeries)
      .where(eq(trackedSeries.trackingStatus, 'active'));

    const existingTmdbIds = new Set(existingTracked.map((s) => s.tmdbId));

    // Step 2: Process each series
    for (const [tmdbId, seriesData] of uniqueSeries) {
      try {
        // Fetch series details from TMDB
        const details = await tmdb.getTVSeriesDetails(tmdbId, 'en-US');
        const detailsRu = await tmdb.getTVSeriesDetails(tmdbId, 'ru-RU');

        const currentSeasons = details.number_of_seasons || 0;
        const seriesStatus = details.status; // 'Returning Series' | 'Ended' | 'Canceled' | etc.

        if (existingTmdbIds.has(tmdbId)) {
          // Update existing tracked series
          const [existing] = await db
            .select()
            .from(trackedSeries)
            .where(eq(trackedSeries.tmdbId, tmdbId))
            .limit(1);

          if (!existing) continue;

          const lastKnownSeasons = existing.lastKnownSeasons;

          // Check for new season
          if (currentSeasons > lastKnownSeasons) {
            results.newSeasons++;

            // Update series with new season info
            await db
              .update(trackedSeries)
              .set({
                currentSeasons,
                lastKnownSeasons: currentSeasons, // Update to current
                newSeasonDetectedAt: new Date(),
                seasonAnnouncementSentAt: null, // Reset for new announcement
                seriesStatus,
                titleRu: detailsRu.name || existing.titleRu,
                updatedAt: new Date(),
              })
              .where(eq(trackedSeries.id, existing.id));

            // Change status to 'want_to_watch' for all users who had it in 'watched'
            const statusUpdateResult = await db
              .update(userMovieLists)
              .set({
                status: 'want_to_watch',
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(userMovieLists.status, 'watched'),
                  eq(userMovieLists.unifiedMovieId, seriesData.unifiedMovieId!)
                )
              )
              .returning({ id: userMovieLists.id });

            results.statusChanges += statusUpdateResult.length;

            // Fetch episodes for new seasons (from lastKnownSeasons + 1 to currentSeasons)
            for (let seasonNum = lastKnownSeasons + 1; seasonNum <= currentSeasons; seasonNum++) {
              if (seasonNum === 0) continue; // Skip season 0 (specials)

              try {
                const seasonDetails = await tmdb.getSeasonDetails(tmdbId, seasonNum, 'en-US');

                for (const episode of seasonDetails.episodes || []) {
                  if (!episode.air_date) continue; // Skip episodes without air date

                  const airDate = episode.air_date;
                  const notifyDate = calculateNotifyDate(airDate, config.episodeDelayDays);

                  await db
                    .insert(trackedEpisodes)
                    .values({
                      trackedSeriesId: existing.id,
                      tmdbId: episode.id,
                      seasonNumber: seasonNum,
                      episodeNumber: episode.episode_number,
                      episodeName: episode.name,
                      airDate,
                      notifyDate,
                    })
                    .onConflictDoNothing();

                  results.newEpisodes++;
                }
              } catch (error) {
                results.errors.push(`Failed to fetch season ${seasonNum} for ${tmdbId}: ${String(error)}`);
              }
            }
          } else {
            // Just update status if series ended
            if (seriesStatus === 'Ended' || seriesStatus === 'Canceled') {
              await db
                .update(trackedSeries)
                .set({
                  trackingStatus: 'ended',
                  seriesStatus,
                  updatedAt: new Date(),
                })
                .where(eq(trackedSeries.id, existing.id));
            }
          }

          results.updatedSeries++;
        } else {
          // Insert new tracked series
          const [newTracked] = await db
            .insert(trackedSeries)
            .values({
              tmdbId,
              unifiedMovieId: seriesData.unifiedMovieId,
              title: details.name || seriesData.title,
              titleRu: detailsRu.name || seriesData.titleRu,
              posterPath: details.poster_path || seriesData.posterPath,
              lastKnownSeasons: currentSeasons,
              currentSeasons,
              seriesStatus,
              trackingStatus: seriesStatus === 'Ended' || seriesStatus === 'Canceled' ? 'ended' : 'active',
            })
            .returning();

          results.newSeries++;

          // Fetch current season episodes for new series (so we don't spam on first sync)
          // We only fetch the latest season to track upcoming episodes
          if (currentSeasons > 0 && newTracked) {
            try {
              const seasonDetails = await tmdb.getSeasonDetails(tmdbId, currentSeasons, 'en-US');
              const today = new Date().toISOString().split('T')[0];

              for (const episode of seasonDetails.episodes || []) {
                if (!episode.air_date) continue;

                // Only add future episodes (or episodes that aired recently)
                if (episode.air_date >= today) {
                  const notifyDate = calculateNotifyDate(episode.air_date, config.episodeDelayDays);

                  await db
                    .insert(trackedEpisodes)
                    .values({
                      trackedSeriesId: newTracked.id,
                      tmdbId: episode.id,
                      seasonNumber: currentSeasons,
                      episodeNumber: episode.episode_number,
                      episodeName: episode.name,
                      airDate: episode.air_date,
                      notifyDate,
                    })
                    .onConflictDoNothing();

                  results.newEpisodes++;
                }
              }
            } catch (error) {
              results.errors.push(`Failed to fetch current season for new series ${tmdbId}: ${String(error)}`);
            }
          }
        }
      } catch (error) {
        results.errors.push(`Failed to process series ${tmdbId}: ${String(error)}`);
      }
    }

    // Step 3: Archive series that no longer have any users watching
    const activeTmdbIds = Array.from(uniqueSeries.keys());
    if (activeTmdbIds.length > 0) {
      const archiveResult = await db
        .update(trackedSeries)
        .set({
          trackingStatus: 'archived',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trackedSeries.trackingStatus, 'active'),
            notInArray(trackedSeries.tmdbId, activeTmdbIds)
          )
        )
        .returning({ id: trackedSeries.id });

      results.archivedSeries = archiveResult.length;
    }

    return NextResponse.json({
      success: true,
      message: 'Series sync completed',
      results,
      config: { syncEnabled: config.syncEnabled, episodeDelayDays: config.episodeDelayDays },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync series cron error:', error);
    return NextResponse.json(
      { error: 'Failed to sync series', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Calculate notification date (air_date + delay days)
 */
function calculateNotifyDate(airDate: string, delayDays: number): string {
  const date = new Date(airDate);
  date.setDate(date.getDate() + delayDays);
  return date.toISOString().split('T')[0];
}

/**
 * Get series notification configuration from database
 */
async function getSeriesConfig(): Promise<{
  syncEnabled: boolean;
  publicEnabled: boolean;
  adminTelegramIds: string[];
  episodeDelayDays: number;
  maxEpisodesPerHour: number;
}> {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, [
        'series.syncEnabled',
        'series.publicEnabled',
        'series.adminTelegramIds',
        'series.episodeDelayDays',
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
    syncEnabled: configMap.get('series.syncEnabled') !== 'false',
    publicEnabled: configMap.get('series.publicEnabled') === 'true',
    adminTelegramIds,
    episodeDelayDays: parseInt(configMap.get('series.episodeDelayDays') || String(DEFAULT_EPISODE_DELAY_DAYS), 10),
    maxEpisodesPerHour: parseInt(configMap.get('series.maxEpisodesPerHour') || '3', 10),
  };
}
