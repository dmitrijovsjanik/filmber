import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { upcomingMovies, notificationConfig, upcomingSyncStats, UPCOMING_MOVIE_STATUS } from '@/lib/db/schema';
import { eq, lt, and, inArray, isNull } from 'drizzle-orm';
import { tmdb } from '@/lib/api/tmdb';
import { parseReleaseDates, getDigitalReleaseDate } from '@/lib/api/release-dates';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Default configuration values
// Low threshold to collect movies early, actual filtering happens at announcement time
const DEFAULT_SYNC_MIN_POPULARITY = 5;
const DEFAULT_PAGES_TO_FETCH = 3;
const ARCHIVE_AFTER_DIGITAL_DAYS = 30;

interface SyncResult {
  newMovies: number;
  updatedMovies: number;
  archivedMovies: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results: SyncResult = {
      newMovies: 0,
      updatedMovies: 0,
      archivedMovies: 0,
      errors: [],
    };

    // Get configuration from database
    const config = await getNotificationConfig();
    const minPopularity = config.syncMinPopularity ?? DEFAULT_SYNC_MIN_POPULARITY;

    // Fetch upcoming movies from TMDB (both US and RU regions)
    const moviesFromTmdb = await fetchUpcomingMovies(DEFAULT_PAGES_TO_FETCH);

    // Get existing tracked movies for comparison
    const existingMovies = await db
      .select({ tmdbId: upcomingMovies.tmdbId })
      .from(upcomingMovies)
      .where(eq(upcomingMovies.status, UPCOMING_MOVIE_STATUS.TRACKED));

    const existingTmdbIds = new Set(existingMovies.map((m) => m.tmdbId));

    // Process each movie
    for (const movie of moviesFromTmdb) {
      // Skip movies below popularity threshold
      if (movie.popularity < minPopularity) continue;

      try {
        // Get detailed release dates
        const releaseDates = await tmdb.getMovieReleaseDates(movie.id);
        const parsedDates = parseReleaseDates(releaseDates);
        const digitalRelease = getDigitalReleaseDate(parsedDates);

        if (existingTmdbIds.has(movie.id)) {
          // Update existing movie if release dates changed
          await db
            .update(upcomingMovies)
            .set({
              theatricalReleaseUs: parsedDates.theatricalUs,
              theatricalReleaseRu: parsedDates.theatricalRu,
              digitalRelease,
              popularity: String(movie.popularity),
              updatedAt: new Date(),
            })
            .where(eq(upcomingMovies.tmdbId, movie.id));
          results.updatedMovies++;
        } else {
          // Insert new movie
          await db.insert(upcomingMovies).values({
            tmdbId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path,
            overview: movie.overview,
            genres: JSON.stringify(movie.genre_ids),
            popularity: String(movie.popularity),
            theatricalReleaseUs: parsedDates.theatricalUs,
            theatricalReleaseRu: parsedDates.theatricalRu,
            digitalRelease,
            status: UPCOMING_MOVIE_STATUS.TRACKED,
          });
          results.newMovies++;
        }
      } catch (error) {
        results.errors.push(`Failed to process movie ${movie.id}: ${String(error)}`);
      }
    }

    // Fetch Russian titles for new movies
    await enrichRussianTitles();

    // Archive old movies (digital release was more than 30 days ago)
    results.archivedMovies = await archiveOldMovies();

    // Record daily statistics
    await updateSyncStats({
      syncNewMovies: results.newMovies,
      syncUpdatedMovies: results.updatedMovies,
      syncArchivedMovies: results.archivedMovies,
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync upcoming cron error:', error);
    return NextResponse.json(
      { error: 'Failed to sync upcoming movies', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Fetch upcoming movies from TMDB (multiple pages, both EN and RU)
 */
async function fetchUpcomingMovies(pages: number) {
  const allMovies = new Map<number, (typeof moviesFromTmdb)[0]>();
  type MovieType = Awaited<ReturnType<typeof tmdb.getUpcomingMovies>>['results'][0];
  const moviesFromTmdb: MovieType[] = [];

  // Fetch from both regions
  for (const region of ['US', 'RU'] as const) {
    for (let page = 1; page <= pages; page++) {
      try {
        const response = await tmdb.getUpcomingMovies({
          language: 'en-US',
          page,
          region,
        });

        for (const movie of response.results) {
          if (!allMovies.has(movie.id)) {
            allMovies.set(movie.id, movie);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch upcoming movies (region: ${region}, page: ${page}):`, error);
      }
    }
  }

  return Array.from(allMovies.values());
}

/**
 * Enrich movies with Russian titles and overviews
 */
async function enrichRussianTitles() {
  // Find movies without Russian overview (more important for quality filtering)
  const moviesWithoutRu = await db
    .select({ id: upcomingMovies.id, tmdbId: upcomingMovies.tmdbId })
    .from(upcomingMovies)
    .where(
      and(
        eq(upcomingMovies.status, UPCOMING_MOVIE_STATUS.TRACKED),
        isNull(upcomingMovies.overviewRu)
      )
    )
    .limit(50); // Increased to handle more movies per sync

  for (const movie of moviesWithoutRu) {
    try {
      const details = await tmdb.getMovieDetails(movie.tmdbId, 'ru-RU');
      await db
        .update(upcomingMovies)
        .set({
          titleRu: details.title || null,
          overviewRu: details.overview || null,
          updatedAt: new Date(),
        })
        .where(eq(upcomingMovies.id, movie.id));
    } catch (error) {
      console.error(`Failed to get Russian data for movie ${movie.tmdbId}:`, error);
    }
  }
}

/**
 * Archive movies with digital release more than 30 days ago
 */
async function archiveOldMovies(): Promise<number> {
  const cutoffDate = new Date(Date.now() - ARCHIVE_AFTER_DIGITAL_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  const result = await db
    .update(upcomingMovies)
    .set({
      status: UPCOMING_MOVIE_STATUS.ARCHIVED,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(upcomingMovies.status, UPCOMING_MOVIE_STATUS.TRACKED),
        lt(upcomingMovies.digitalRelease, cutoffDateStr)
      )
    )
    .returning({ id: upcomingMovies.id });

  return result.length;
}

/**
 * Get notification configuration from database
 */
async function getNotificationConfig(): Promise<{
  enabled: boolean;
  syncMinPopularity: number;
}> {
  const configs = await db
    .select()
    .from(notificationConfig)
    .where(
      inArray(notificationConfig.key, ['upcoming.enabled', 'upcoming.syncMinPopularity'])
    );

  const configMap = new Map(configs.map((c) => [c.key, c.value]));

  return {
    enabled: configMap.get('upcoming.enabled') !== 'false',
    syncMinPopularity: parseInt(configMap.get('upcoming.syncMinPopularity') || String(DEFAULT_SYNC_MIN_POPULARITY), 10),
  };
}

/**
 * Update daily sync statistics (upsert)
 */
async function updateSyncStats(stats: {
  syncNewMovies: number;
  syncUpdatedMovies: number;
  syncArchivedMovies: number;
}) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Try to update existing record
    const updated = await db
      .update(upcomingSyncStats)
      .set({
        syncNewMovies: stats.syncNewMovies,
        syncUpdatedMovies: stats.syncUpdatedMovies,
        syncArchivedMovies: stats.syncArchivedMovies,
        updatedAt: new Date(),
      })
      .where(eq(upcomingSyncStats.date, today))
      .returning({ id: upcomingSyncStats.id });

    // If no record exists, insert new one
    if (updated.length === 0) {
      await db.insert(upcomingSyncStats).values({
        date: today,
        ...stats,
      });
    }
  } catch (error) {
    console.error('Failed to update sync stats:', error);
  }
}
