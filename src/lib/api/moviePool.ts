import { tmdb, TMDBClient } from './tmdb';
import { db } from '../db';
import { movies } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { shuffle } from '../utils/shuffle';
import type { Movie, MediaTypeFilter } from '@/types/movie';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Supported locales
export type SupportedLocale = 'en' | 'ru';

// Map short locale to TMDB locale format
function getTmdbLocale(locale: SupportedLocale): 'ru-RU' | 'en-US' {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

interface PoolItem {
  id: number;
  mediaType: 'movie' | 'tv';
}

// Cache for pool items to avoid refetching TMDB lists
const poolCache = new Map<string, { items: PoolItem[]; timestamp: number }>();
const POOL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Request deduplication: prevents parallel requests for the same movie
const pendingRequests = new Map<string, Promise<Movie | null>>();

// Timeout for TMDB API calls (10 seconds)
const API_TIMEOUT_MS = 10_000;

/**
 * Wrap a promise with a timeout. Returns null if timeout exceeded.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch {
    clearTimeout(timeoutId!);
    return null;
  }
}

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
 *
 * @param locale - The locale to fetch data for ('en' or 'ru'). Only fetches one locale per request.
 */
export async function generatePaginatedMoviePool(
  seed: number,
  offset: number = 0,
  limit: number = 20,
  mediaTypeFilter: MediaTypeFilter = 'all',
  locale: SupportedLocale = 'en'
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
        ? enhanceMovieData(item.id, locale)
        : enhanceTVData(item.id, locale)
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

export async function enhanceMovieData(
  tmdbId: number,
  locale: SupportedLocale = 'en'
): Promise<Movie | null> {
  // Check movies table first
  let existingCached: CachedMovieData | null = null;
  try {
    const [cached] = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId));

    if (cached && isRecentCache(cached.cachedAt)) {
      // Check if we have the requested locale
      const hasRequestedLocale =
        locale === 'en' ? cached.title : cached.titleRu;

      if (hasRequestedLocale) {
        return formatCachedMovie(cached);
      }
      // We have cached data but missing the requested locale - will fetch and merge
      existingCached = cached;
    }
  } catch {
    // DB might not be available, continue without cache
  }

  // Use request deduplication to prevent parallel fetches for same movie+locale
  const cacheKey = `movie-${tmdbId}-${locale}`;
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async (): Promise<Movie | null> => {
    try {
      // Fetch only the requested locale from TMDB
      const tmdbLocale = getTmdbLocale(locale);
      const details = await withTimeout(
        tmdb.getMovieDetails(tmdbId, tmdbLocale),
        API_TIMEOUT_MS
      );

      if (!details) {
        console.warn(`Timeout fetching movie ${tmdbId}`);
        // If we have existing cached data, return it even if missing this locale
        if (existingCached) {
          return formatCachedMovie(existingCached);
        }
        return null;
      }

      // Build movie entry, merging with existing cached data if available
      const movieEntry = {
        tmdbId,
        // For English locale: set title/overview, preserve existing Russian
        // For Russian locale: set titleRu/overviewRu, preserve existing English
        title: locale === 'en' ? details.title : (existingCached?.title || details.title),
        titleRu: locale === 'ru' ? details.title : (existingCached?.titleRu || null),
        overview: locale === 'en' ? details.overview : (existingCached?.overview || details.overview),
        overviewRu: locale === 'ru' ? details.overview : (existingCached?.overviewRu || null),
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.release_date,
        tmdbRating: details.vote_average.toString(),
        tmdbVoteCount: details.vote_count,
        tmdbPopularity: details.popularity.toString(),
        imdbId: details.imdb_id,
        imdbRating: null,
        rottenTomatoesRating: null,
        metacriticRating: null,
        genres: JSON.stringify((details.genres || []).map((g) => g.name)),
        runtime: details.runtime,
        originalLanguage: details.original_language || null,
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
              // Only update fields that we fetched, preserve others
              ...(locale === 'en'
                ? { title: movieEntry.title, overview: movieEntry.overview }
                : { titleRu: movieEntry.titleRu, overviewRu: movieEntry.overviewRu }),
              posterPath: movieEntry.posterPath,
              backdropPath: movieEntry.backdropPath,
              releaseDate: movieEntry.releaseDate,
              tmdbRating: movieEntry.tmdbRating,
              tmdbVoteCount: movieEntry.tmdbVoteCount,
              tmdbPopularity: movieEntry.tmdbPopularity,
              imdbId: movieEntry.imdbId,
              genres: movieEntry.genres,
              runtime: movieEntry.runtime,
              originalLanguage: movieEntry.originalLanguage,
              updatedAt: new Date(),
            },
          });
      } catch {
        // Ignore cache errors
      }

      return formatCachedMovie(movieEntry);
    } catch (error) {
      console.error(`Failed to enhance movie ${tmdbId}:`, error);
      // Return existing cached data if available
      if (existingCached) {
        return formatCachedMovie(existingCached);
      }
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function enhanceTVData(
  tmdbId: number,
  locale: SupportedLocale = 'en'
): Promise<Movie | null> {
  // Check movies table first (TV series are also stored there)
  let existingCached: CachedMovieData | null = null;
  try {
    const [cached] = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId));

    if (cached && cached.mediaType === 'tv' && isRecentCache(cached.cachedAt)) {
      // Check if we have the requested locale
      const hasRequestedLocale =
        locale === 'en' ? cached.title : cached.titleRu;

      if (hasRequestedLocale) {
        return formatCachedMovie(cached);
      }
      // We have cached data but missing the requested locale - will fetch and merge
      existingCached = cached;
    }
  } catch {
    // DB might not be available, continue without cache
  }

  // Use request deduplication to prevent parallel fetches for same TV series+locale
  const cacheKey = `tv-${tmdbId}-${locale}`;
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async (): Promise<Movie | null> => {
    try {
      // Fetch only the requested locale from TMDB
      const tmdbLocale = getTmdbLocale(locale);
      const details = await withTimeout(
        tmdb.getTVSeriesDetails(tmdbId, tmdbLocale),
        API_TIMEOUT_MS
      );

      if (!details) {
        console.warn(`Timeout fetching TV series ${tmdbId}`);
        if (existingCached) {
          return formatCachedMovie(existingCached);
        }
        return null;
      }

      // Calculate average runtime from episode_run_time array
      const avgRuntime =
        details.episode_run_time && details.episode_run_time.length > 0
          ? Math.round(
              details.episode_run_time.reduce((a: number, b: number) => a + b, 0) /
                details.episode_run_time.length
            )
          : null;

      // Build TV entry, merging with existing cached data if available
      const tvEntry = {
        tmdbId,
        title: locale === 'en' ? details.name : (existingCached?.title || details.name),
        titleRu: locale === 'ru' ? details.name : (existingCached?.titleRu || null),
        overview: locale === 'en' ? details.overview : (existingCached?.overview || details.overview),
        overviewRu: locale === 'ru' ? details.overview : (existingCached?.overviewRu || null),
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        releaseDate: details.first_air_date,
        tmdbRating: details.vote_average.toString(),
        tmdbVoteCount: details.vote_count,
        tmdbPopularity: details.popularity.toString(),
        imdbId: null,
        imdbRating: null,
        rottenTomatoesRating: null,
        metacriticRating: null,
        genres: JSON.stringify((details.genres || []).map((g) => g.name)),
        runtime: avgRuntime,
        originalLanguage: details.original_language || null,
        mediaType: 'tv' as const,
        numberOfSeasons: details.number_of_seasons,
        numberOfEpisodes: details.number_of_episodes,
        primarySource: 'tmdb' as const,
        cachedAt: new Date(),
        updatedAt: new Date(),
      };

      // Try to cache the data in movies table
      try {
        await db
          .insert(movies)
          .values(tvEntry)
          .onConflictDoUpdate({
            target: movies.tmdbId,
            set: {
              // Only update fields that we fetched, preserve others
              ...(locale === 'en'
                ? { title: tvEntry.title, overview: tvEntry.overview }
                : { titleRu: tvEntry.titleRu, overviewRu: tvEntry.overviewRu }),
              posterPath: tvEntry.posterPath,
              backdropPath: tvEntry.backdropPath,
              releaseDate: tvEntry.releaseDate,
              tmdbRating: tvEntry.tmdbRating,
              tmdbVoteCount: tvEntry.tmdbVoteCount,
              tmdbPopularity: tvEntry.tmdbPopularity,
              genres: tvEntry.genres,
              runtime: tvEntry.runtime,
              originalLanguage: tvEntry.originalLanguage,
              numberOfSeasons: tvEntry.numberOfSeasons,
              numberOfEpisodes: tvEntry.numberOfEpisodes,
              updatedAt: new Date(),
            },
          });
      } catch {
        // Ignore cache errors
      }

      return formatCachedMovie(tvEntry);
    } catch (error) {
      console.error(`Failed to enhance TV series ${tmdbId}:`, error);
      if (existingCached) {
        return formatCachedMovie(existingCached);
      }
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
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

// Parse genres from JSON - handles both old format (strings) and new format ({id, name} objects)
function parseGenres(genresJson: string | null): string[] {
  if (!genresJson) return [];
  try {
    const parsed = JSON.parse(genresJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((g: { name: string } | string) =>
      typeof g === 'string' ? g : g.name
    );
  } catch {
    return [];
  }
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
    genres: parseGenres(cached.genres),
    runtime: cached.runtime,
    mediaType: (cached.mediaType as 'movie' | 'tv') || 'movie',
    numberOfSeasons: cached.numberOfSeasons || null,
    numberOfEpisodes: cached.numberOfEpisodes || null,
  };
}

/**
 * Batch fetch movies by IDs - used for priority queue items.
 */
export async function getMoviesByIds(
  tmdbIds: number[],
  locale: SupportedLocale = 'en'
): Promise<Map<number, Movie>> {
  const result = new Map<number, Movie>();
  if (tmdbIds.length === 0) return result;

  // Batch fetch from DB
  const cachedMovies = await db
    .select()
    .from(movies)
    .where(inArray(movies.tmdbId, tmdbIds));

  const foundIds = new Set<number>();
  const needsLocale: number[] = [];

  for (const cached of cachedMovies) {
    if (!cached.tmdbId) continue;
    // Check if we have the requested locale
    const hasRequestedLocale = locale === 'en' ? cached.title : cached.titleRu;
    if (hasRequestedLocale) {
      foundIds.add(cached.tmdbId);
      result.set(cached.tmdbId, formatCachedMovie(cached));
    } else {
      // Have cached data but missing requested locale
      needsLocale.push(cached.tmdbId);
    }
  }

  // Fetch missing movies + movies that need the requested locale
  const missingIds = tmdbIds.filter((id) => !foundIds.has(id));
  const allToFetch = [...new Set([...missingIds, ...needsLocale])];
  const fetchPromises = allToFetch.map((id) => enhanceMovieData(id, locale));
  const fetchResults = await Promise.all(fetchPromises);

  fetchResults.forEach((movie, index) => {
    if (movie) {
      result.set(allToFetch[index], movie);
    }
  });

  return result;
}
