import { tmdb, TMDBClient } from './tmdb';
import { omdb, OMDBClient } from './omdb';
import { db } from '../db';
import { movies } from '../db/schema';
import { eq } from 'drizzle-orm';
import { shuffle } from '../utils/shuffle';
import type { Movie, MediaTypeFilter } from '@/types/movie';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface PoolItem {
  id: number;
  mediaType: 'movie' | 'tv';
}

export async function generateMoviePool(
  seed: number,
  mediaTypeFilter: MediaTypeFilter = 'all'
): Promise<Movie[]> {
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

    const movies = [
      ...topRatedResults.flat().slice(0, 100),
      ...releasesResults.flat().slice(0, 40),
    ];

    poolItems.push(...movies.map((m) => ({ id: m.id, mediaType: 'movie' as const })));
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

  // Shuffle with seed for consistent ordering between users
  const shuffled = shuffle(uniqueItems, seed);

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
      imdbRating: omdbData?.imdbRating || null,
      rottenTomatoesRating: omdbData
        ? OMDBClient.getRottenTomatoesRating(omdbData.Ratings)
        : null,
      metacriticRating: omdbData?.Metascore || null,
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
        imdb: detailsEn.external_ids?.imdb_id || null,
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

// Get a simplified movie list without full details (for faster initial load)
export async function getSimpleMoviePool(
  seed: number,
  mediaTypeFilter: MediaTypeFilter = 'all'
): Promise<Movie[]> {
  const items: Movie[] = [];

  // Fetch movies if filter allows
  if (mediaTypeFilter === 'all' || mediaTypeFilter === 'movie') {
    const [page1, page2, page3] = await Promise.all([
      tmdb.getPopular('en-US', 1),
      tmdb.getPopular('en-US', 2),
      tmdb.getTopRated('en-US', 1),
    ]);

    const allMovies = [...page1, ...page2, ...page3];
    const uniqueMovies = [...new Map(allMovies.map((m) => [m.id, m])).values()];

    items.push(
      ...uniqueMovies.map((movie) => ({
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
          kinopoisk: null,
          rottenTomatoes: null,
          metacritic: null,
        },
        genres: [],
        runtime: null,
        mediaType: 'movie' as const,
        numberOfSeasons: null,
        numberOfEpisodes: null,
      }))
    );
  }

  // Fetch TV series if filter allows
  if (mediaTypeFilter === 'all' || mediaTypeFilter === 'tv') {
    const [tvPage1, tvPage2, tvPage3] = await Promise.all([
      tmdb.getPopularTV('en-US', 1),
      tmdb.getPopularTV('en-US', 2),
      tmdb.getTopRatedTV('en-US', 1),
    ]);

    const allTV = [...tvPage1, ...tvPage2, ...tvPage3];
    const uniqueTV = [...new Map(allTV.map((tv) => [tv.id, tv])).values()];

    items.push(
      ...uniqueTV.map((tv) => ({
        tmdbId: tv.id,
        title: tv.name,
        titleRu: null,
        overview: tv.overview,
        overviewRu: null,
        posterUrl: TMDBClient.getPosterUrl(tv.poster_path),
        releaseDate: tv.first_air_date,
        ratings: {
          tmdb: tv.vote_average.toString(),
          imdb: null,
          kinopoisk: null,
          rottenTomatoes: null,
          metacritic: null,
        },
        genres: [],
        runtime: null,
        mediaType: 'tv' as const,
        numberOfSeasons: null,
        numberOfEpisodes: null,
      }))
    );
  }

  return shuffle(items, seed);
}
