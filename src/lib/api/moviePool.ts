import { tmdb, TMDBClient } from './tmdb';
import { omdb, OMDBClient } from './omdb';
import { db } from '../db';
import { movieCache } from '../db/schema';
import { eq } from 'drizzle-orm';
import { shuffle } from '../utils/shuffle';
import type { Movie } from '@/types/movie';
import type { MovieCacheEntry } from '../db/schema';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function generateMoviePool(seed: number): Promise<Movie[]> {
  // Fetch Top 100 (5 pages of 20 movies each)
  const topRatedPromises = [];
  for (let page = 1; page <= 5; page++) {
    topRatedPromises.push(tmdb.getTopRated('en-US', page));
  }

  // Fetch 2025 releases (2 pages)
  const releasesPromises = [];
  for (let page = 1; page <= 2; page++) {
    releasesPromises.push(tmdb.get2025Releases('en-US', page));
  }

  const [topRatedResults, releasesResults] = await Promise.all([
    Promise.all(topRatedPromises),
    Promise.all(releasesPromises),
  ]);

  const allMovies = [
    ...topRatedResults.flat().slice(0, 100),
    ...releasesResults.flat().slice(0, 40),
  ];

  // Remove duplicates by ID
  const uniqueMovies = [...new Map(allMovies.map((m) => [m.id, m])).values()];

  // Shuffle with seed for consistent ordering between users
  const shuffled = shuffle(uniqueMovies, seed);

  // Enhance with detailed info (cached)
  const enhanced = await Promise.all(
    shuffled.map((movie) => enhanceMovieData(movie.id))
  );

  return enhanced.filter((m): m is Movie => m !== null);
}

export async function enhanceMovieData(tmdbId: number): Promise<Movie | null> {
  // Check cache first
  try {
    const [cached] = await db
      .select()
      .from(movieCache)
      .where(eq(movieCache.tmdbId, tmdbId));

    if (cached && isRecentCache(cached.cachedAt)) {
      return formatCachedMovie(cached);
    }
  } catch {
    // DB might not be available, continue without cache
  }

  try {
    // Fetch fresh data from TMDB
    const [detailsEn, detailsRu] = await Promise.all([
      tmdb.getMovieDetails(tmdbId, 'en-US'),
      tmdb.getMovieDetails(tmdbId, 'ru-RU'),
    ]);

    // Fetch OMDB data if IMDB ID is available
    let omdbData = null;
    if (detailsEn.imdb_id) {
      omdbData = await omdb.getByImdbId(detailsEn.imdb_id);
    }

    const cacheEntry = {
      tmdbId,
      title: detailsEn.title,
      titleRu: detailsRu.title !== detailsEn.title ? detailsRu.title : null,
      overview: detailsEn.overview,
      overviewRu:
        detailsRu.overview !== detailsEn.overview ? detailsRu.overview : null,
      posterPath: detailsEn.poster_path,
      backdropPath: detailsEn.backdrop_path,
      releaseDate: detailsEn.release_date,
      voteAverage: detailsEn.vote_average.toString(),
      voteCount: detailsEn.vote_count,
      popularity: detailsEn.popularity.toString(),
      imdbId: detailsEn.imdb_id,
      imdbRating: omdbData?.imdbRating || null,
      rottenTomatoesRating: omdbData
        ? OMDBClient.getRottenTomatoesRating(omdbData.Ratings)
        : null,
      metacriticRating: omdbData?.Metascore || null,
      genres: JSON.stringify(detailsEn.genres.map((g) => g.name)),
      runtime: detailsEn.runtime,
      cachedAt: new Date(),
    };

    // Try to cache the data
    try {
      await db
        .insert(movieCache)
        .values(cacheEntry)
        .onConflictDoUpdate({
          target: movieCache.tmdbId,
          set: cacheEntry,
        });
    } catch {
      // Ignore cache errors
    }

    return formatCachedMovie(cacheEntry as MovieCacheEntry);
  } catch (error) {
    console.error(`Failed to enhance movie ${tmdbId}:`, error);
    return null;
  }
}

function isRecentCache(cachedAt: Date): boolean {
  return Date.now() - cachedAt.getTime() < THIRTY_DAYS_MS;
}

function formatCachedMovie(cached: MovieCacheEntry): Movie {
  return {
    tmdbId: cached.tmdbId,
    title: cached.title,
    titleRu: cached.titleRu,
    overview: cached.overview || '',
    overviewRu: cached.overviewRu,
    posterUrl: TMDBClient.getPosterUrl(cached.posterPath),
    releaseDate: cached.releaseDate || '',
    ratings: {
      tmdb: cached.voteAverage || '0',
      imdb: cached.imdbRating,
      rottenTomatoes: cached.rottenTomatoesRating,
      metacritic: cached.metacriticRating,
    },
    genres: JSON.parse(cached.genres || '[]'),
    runtime: cached.runtime,
  };
}

// Get a simplified movie list without full details (for faster initial load)
export async function getSimpleMoviePool(seed: number): Promise<Movie[]> {
  // Fetch popular movies (faster than top_rated + discover)
  const [page1, page2, page3] = await Promise.all([
    tmdb.getPopular('en-US', 1),
    tmdb.getPopular('en-US', 2),
    tmdb.getTopRated('en-US', 1),
  ]);

  const allMovies = [...page1, ...page2, ...page3];
  const uniqueMovies = [...new Map(allMovies.map((m) => [m.id, m])).values()];
  const shuffled = shuffle(uniqueMovies, seed);

  return shuffled.map((movie) => ({
    tmdbId: movie.id,
    title: movie.title,
    titleRu: null,
    overview: movie.overview,
    overviewRu: null,
    posterUrl: TMDBClient.getPosterUrl(movie.poster_path),
    releaseDate: movie.release_date,
    ratings: {
      tmdb: movie.vote_average.toString(),
      imdb: null,
      rottenTomatoes: null,
      metacritic: null,
    },
    genres: [],
    runtime: null,
  }));
}
