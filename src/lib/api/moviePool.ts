import { tmdb, TMDBClient } from './tmdb';
import { db } from '../db';
import { movies } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { shuffle } from '../utils/shuffle';
import type { Movie, MediaTypeFilter } from '@/types/movie';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface PoolItem {
  id: number;
  mediaType: 'movie' | 'tv';
}

// Cache for pool items to avoid refetching TMDB lists
const poolCache = new Map<string, { items: PoolItem[]; timestamp: number }>();
const POOL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Generate pool item IDs without enhancement (fast).
 * Uses caching to avoid repeated TMDB list calls.
 */
async function generatePoolItems(mediaTypeFilter: MediaTypeFilter = 'all'): Promise<PoolItem[]> {
  const cacheKey = `pool-${mediaTypeFilter}`;
  const cached = poolCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    return cached.items;
  }

  const poolItems: PoolItem[] = [];

  // Fetch movies if filter allows
  if (mediaTypeFilter === 'all' || mediaTypeFilter === 'movie') {
    const topRatedPromises = [];
    for (let page = 1; page <= 5; page++) {
      topRatedPromises.push(tmdb.getTopRated('en-US', page));
    }

    const releasesPromises = [];
    for (let page = 1; page <= 2; page++) {
      releasesPromises.push(tmdb.get2025Releases('en-US', page));
    }

    const [topRatedResults, releasesResults] = await Promise.all([
      Promise.all(topRatedPromises),
      Promise.all(releasesPromises),
    ]);

    const moviesList = [
      ...topRatedResults.flat().slice(0, 100),
      ...releasesResults.flat().slice(0, 40),
    ];

    poolItems.push(...moviesList.map((m) => ({ id: m.id, mediaType: 'movie' as const })));
  }

  // Fetch TV series if filter allows
  if (mediaTypeFilter === 'all' || mediaTypeFilter === 'tv') {
    const tvPromises = [];
    for (let page = 1; page <= 3; page++) {
      tvPromises.push(tmdb.getTopRatedTV('en-US', page));
      tvPromises.push(tmdb.getPopularTV('en-US', page));
    }

    const tvResults = await Promise.all(tvPromises);
    const tvShows = tvResults.flat().slice(0, 100);

    poolItems.push(...tvShows.map((tv) => ({ id: tv.id, mediaType: 'tv' as const })));
  }

  // Remove duplicates by ID+mediaType
  const uniqueItems = [
    ...new Map(poolItems.map((item) => [`${item.mediaType}-${item.id}`, item])).values(),
  ];

  // Cache the result
  poolCache.set(cacheKey, { items: uniqueItems, timestamp: Date.now() });

  return uniqueItems;
}

/**
 * Generate a paginated movie pool - only enhances the requested batch.
 * Much faster than generating the full pool upfront.
 */
export async function generatePaginatedMoviePool(
  seed: number,
  offset: number = 0,
  limit: number = 20,
  mediaTypeFilter: MediaTypeFilter = 'all'
): Promise<{ movies: Movie[]; totalCount: number; hasMore: boolean }> {
  // Get all pool items (fast, cached)
  const poolItems = await generatePoolItems(mediaTypeFilter);

  // Shuffle with seed for consistent ordering
  const shuffled = shuffle(poolItems, seed);

  // Get the slice we need
  const slice = shuffled.slice(offset, offset + limit);

  // Enhance only the slice (this is the expensive part)
  const enhanced = await Promise.all(
    slice.map((item) =>
      item.mediaType === 'movie'
        ? enhanceMovieData(item.id)
        : enhanceTVData(item.id)
    )
  );

  const validMovies = enhanced.filter((m): m is Movie => m !== null);

  return {
    movies: validMovies,
    totalCount: shuffled.length,
    hasMore: offset + limit < shuffled.length,
  };
}

/**
 * @deprecated Use generatePaginatedMoviePool instead for better performance.
 * This function is kept for backward compatibility but enhances ALL movies upfront.
 */
export async function generateMoviePool(
  seed: number,
  mediaTypeFilter: MediaTypeFilter = 'all'
): Promise<Movie[]> {
  const poolItems = await generatePoolItems(mediaTypeFilter);
  const shuffled = shuffle(poolItems, seed);

  // Enhance with detailed info (cached)
  const enhanced = await Promise.all(
    shuffled.map((item) =>
      item.mediaType === 'movie'
        ? enhanceMovieData(item.id)
        : enhanceTVData(item.id)
    )
  );

  return enhanced.filter((m): m is Movie => m !== null);
}

export async function enhanceMovieData(tmdbId: number): Promise<Movie | null> {
  // Check movies table first
  try {
    const [cached] = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId));

    if (cached && isRecentCache(cached.cachedAt)) {
      return formatCachedMovie(cached);
    }
  } catch {
    // DB might not be available, continue without cache
  }

  try {
    // Fetch fresh data from TMDB only
    const [detailsEn, detailsRu] = await Promise.all([
      tmdb.getMovieDetails(tmdbId, 'en-US'),
      tmdb.getMovieDetails(tmdbId, 'ru-RU'),
    ]);

    const movieEntry = {
      tmdbId,
      title: detailsEn.title,
      titleRu: detailsRu.title !== detailsEn.title ? detailsRu.title : null,
      overview: detailsEn.overview,
      overviewRu:
        detailsRu.overview !== detailsEn.overview ? detailsRu.overview : null,
      posterPath: detailsEn.poster_path,
      backdropPath: detailsEn.backdrop_path,
      releaseDate: detailsEn.release_date,
      tmdbRating: detailsEn.vote_average.toString(),
      tmdbVoteCount: detailsEn.vote_count,
      tmdbPopularity: detailsEn.popularity.toString(),
      imdbId: detailsEn.imdb_id,
      imdbRating: null, // No longer fetching from OMDB
      rottenTomatoesRating: null,
      metacriticRating: null,
      genres: JSON.stringify(detailsEn.genres),
      runtime: detailsEn.runtime,
      originalLanguage: detailsEn.original_language || null,
      mediaType: 'movie' as const,
      primarySource: 'tmdb' as const,
      cachedAt: new Date(),
      updatedAt: new Date(),
    };

    // Try to cache the data in movies table
    try {
      await db
        .insert(movies)
        .values(movieEntry)
        .onConflictDoUpdate({
          target: movies.tmdbId,
          set: {
            ...movieEntry,
            updatedAt: new Date(),
          },
        });
    } catch {
      // Ignore cache errors
    }

    return formatCachedMovie(movieEntry);
  } catch (error) {
    console.error(`Failed to enhance movie ${tmdbId}:`, error);
    return null;
  }
}

export async function enhanceTVData(tmdbId: number): Promise<Movie | null> {
  try {
    // Fetch fresh data from TMDB for TV series
    const [detailsEn, detailsRu] = await Promise.all([
      tmdb.getTVSeriesDetails(tmdbId, 'en-US'),
      tmdb.getTVSeriesDetails(tmdbId, 'ru-RU'),
    ]);

    // Calculate average runtime from episode_run_time array
    const avgRuntime =
      detailsEn.episode_run_time && detailsEn.episode_run_time.length > 0
        ? Math.round(
            detailsEn.episode_run_time.reduce((a, b) => a + b, 0) /
              detailsEn.episode_run_time.length
          )
        : null;

    return {
      tmdbId,
      title: detailsEn.name,
      titleRu: detailsRu.name !== detailsEn.name ? detailsRu.name : null,
      overview: detailsEn.overview || '',
      overviewRu:
        detailsRu.overview !== detailsEn.overview ? detailsRu.overview : null,
      posterUrl: TMDBClient.getPosterUrl(detailsEn.poster_path),
      releaseDate: detailsEn.first_air_date || '',
      ratings: {
        tmdb: detailsEn.vote_average.toString(),
        imdb: null,
        kinopoisk: null,
        rottenTomatoes: null,
        metacritic: null,
      },
      genres: detailsEn.genres.map((g) => g.name),
      runtime: avgRuntime,
      mediaType: 'tv',
      numberOfSeasons: detailsEn.number_of_seasons,
      numberOfEpisodes: detailsEn.number_of_episodes,
    };
  } catch (error) {
    console.error(`Failed to enhance TV series ${tmdbId}:`, error);
    return null;
  }
}

function isRecentCache(cachedAt: Date): boolean {
  return Date.now() - cachedAt.getTime() < THIRTY_DAYS_MS;
}

interface CachedMovieData {
  tmdbId: number | null;
  title: string;
  titleRu: string | null;
  overview: string | null;
  overviewRu: string | null;
  posterPath: string | null;
  posterUrl?: string | null;
  localPosterPath?: string | null;
  releaseDate: string | null;
  tmdbRating: string | null;
  imdbRating: string | null;
  kinopoiskRating?: string | null;
  rottenTomatoesRating: string | null;
  metacriticRating: string | null;
  genres: string | null;
  runtime: number | null;
  mediaType?: string | null;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
}

function formatCachedMovie(cached: CachedMovieData): Movie {
  return {
    tmdbId: cached.tmdbId!,
    title: cached.title,
    titleRu: cached.titleRu,
    overview: cached.overview || '',
    overviewRu: cached.overviewRu,
    posterUrl: TMDBClient.getSmartPosterUrl(
      cached.localPosterPath,
      cached.posterPath,
      cached.posterUrl
    ),
    releaseDate: cached.releaseDate || '',
    ratings: {
      tmdb: cached.tmdbRating || '0',
      imdb: cached.imdbRating,
      kinopoisk: cached.kinopoiskRating || null,
      rottenTomatoes: cached.rottenTomatoesRating,
      metacritic: cached.metacriticRating,
    },
    genres: JSON.parse(cached.genres || '[]'),
    runtime: cached.runtime,
    mediaType: (cached.mediaType as 'movie' | 'tv') || 'movie',
    numberOfSeasons: cached.numberOfSeasons || null,
    numberOfEpisodes: cached.numberOfEpisodes || null,
  };
}

/**
 * Batch fetch movies by IDs - used for priority queue items.
 */
export async function getMoviesByIds(tmdbIds: number[]): Promise<Map<number, Movie>> {
  const result = new Map<number, Movie>();
  if (tmdbIds.length === 0) return result;

  // Batch fetch from DB
  const cachedMovies = await db
    .select()
    .from(movies)
    .where(inArray(movies.tmdbId, tmdbIds));

  const foundIds = new Set<number>();
  for (const cached of cachedMovies) {
    if (!cached.tmdbId) continue;
    foundIds.add(cached.tmdbId);
    result.set(cached.tmdbId, formatCachedMovie(cached));
  }

  // Fetch missing movies from external API
  const missingIds = tmdbIds.filter((id) => !foundIds.has(id));
  const missingPromises = missingIds.map((id) => enhanceMovieData(id));
  const missingResults = await Promise.all(missingPromises);

  missingResults.forEach((movie, index) => {
    if (movie) {
      result.set(missingIds[index], movie);
    }
  });

  return result;
}
