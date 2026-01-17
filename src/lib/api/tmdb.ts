import type {
  TMDBMovie,
  TMDBMovieDetails,
  TMDBTVSeries,
  TMDBTVSeriesDetails,
  TMDBSeason,
  TMDBVideo,
  TMDBReleaseDates,
} from '@/types/movie';
import { ProxyAgent, fetch as proxyFetch } from 'undici';
import {
  POSTER_SIZES,
  getPosterUrl,
  getBackdropUrl,
  type PosterSize,
  type TMDBPosterSize,
} from './poster';

// Re-export poster utilities for backward compatibility with server-side code
export { POSTER_SIZES, getPosterUrl, getBackdropUrl, type PosterSize, type TMDBPosterSize };

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HTTP proxy for TMDB requests (v2ray on server)
const TMDB_PROXY_URL = process.env.TMDB_PROXY_URL;

// In-memory genre cache (genres rarely change - cache for 24 hours)
const GENRE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
interface GenreCache {
  data: { id: number; name: string }[];
  timestamp: number;
}
const genreCache = new Map<string, GenreCache>();

function getCachedGenres(key: string): { id: number; name: string }[] | null {
  const cached = genreCache.get(key);
  if (cached && Date.now() - cached.timestamp < GENRE_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedGenres(key: string, data: { id: number; name: string }[]): void {
  genreCache.set(key, { data, timestamp: Date.now() });
}

// Custom fetch that uses proxy if configured
async function tmdbFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (TMDB_PROXY_URL) {
    const dispatcher = new ProxyAgent(TMDB_PROXY_URL);
    const response = await proxyFetch(url, {
      ...options,
      dispatcher,
    } as Parameters<typeof proxyFetch>[1]);
    return response as unknown as Response;
  }
  return fetch(url, options);
}

interface TMDBResponse<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}

class TMDBClient {
  private accessToken: string;

  constructor() {
    this.accessToken = process.env.TMDB_ACCESS_TOKEN || '';
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await tmdbFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  }

  // Get top rated movies
  async getTopRated(
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<TMDBMovie[]> {
    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/movie/top_rated', {
      language,
      page: page.toString(),
    });
    return data.results;
  }

  // Get popular movies
  async getPopular(
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<TMDBMovie[]> {
    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/movie/popular', {
      language,
      page: page.toString(),
    });
    return data.results;
  }

  // Get 2025 releases
  async get2025Releases(
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<TMDBMovie[]> {
    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/discover/movie', {
      language,
      page: page.toString(),
      primary_release_year: '2025',
      sort_by: 'popularity.desc',
    });
    return data.results;
  }

  // Get movie details with IMDB ID
  async getMovieDetails(
    movieId: number,
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<TMDBMovieDetails> {
    return this.fetch<TMDBMovieDetails>(`/movie/${movieId}`, { language });
  }

  // Search movies by title
  async searchMovies(
    query: string,
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<{ results: TMDBMovie[]; totalResults: number }> {
    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/search/movie', {
      query,
      language,
      page: page.toString(),
      include_adult: 'false',
    });
    return {
      results: data.results,
      totalResults: data.total_results,
    };
  }

  // Get list of movie genres (cached for 24 hours)
  async getGenres(
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<{ id: number; name: string }[]> {
    const cacheKey = `movie:${language}`;
    const cached = getCachedGenres(cacheKey);
    if (cached) return cached;

    const data = await this.fetch<{ genres: { id: number; name: string }[] }>(
      '/genre/movie/list',
      { language }
    );
    setCachedGenres(cacheKey, data.genres);
    return data.genres;
  }

  // Discover movies with filters
  async discoverMovies(params: {
    genres?: number[];
    yearFrom?: number;
    yearTo?: number;
    ratingMin?: number;
    sortBy?: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'vote_count.desc';
    page?: number;
    language?: 'en-US' | 'ru-RU';
    originalLanguage?: string; // ISO 639-1 code (en, ru, ko, ja, etc.)
    runtimeMin?: number; // minutes
    runtimeMax?: number; // minutes
  }): Promise<{ results: TMDBMovie[]; totalResults: number; totalPages: number }> {
    const queryParams: Record<string, string> = {
      language: params.language || 'en-US',
      page: String(params.page || 1),
      include_adult: 'false',
    };

    if (params.genres?.length) {
      queryParams.with_genres = params.genres.join(',');
    }
    if (params.yearFrom) {
      queryParams['primary_release_date.gte'] = `${params.yearFrom}-01-01`;
    }
    if (params.yearTo) {
      queryParams['primary_release_date.lte'] = `${params.yearTo}-12-31`;
    }
    if (params.ratingMin) {
      queryParams['vote_average.gte'] = String(params.ratingMin);
      queryParams['vote_count.gte'] = '100'; // Filter low-quality entries
    }
    if (params.sortBy) {
      queryParams.sort_by = params.sortBy;
    }
    if (params.originalLanguage) {
      queryParams.with_original_language = params.originalLanguage;
    }
    if (params.runtimeMin) {
      queryParams['with_runtime.gte'] = String(params.runtimeMin);
    }
    if (params.runtimeMax) {
      queryParams['with_runtime.lte'] = String(params.runtimeMax);
    }

    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/discover/movie', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
  }

  // ============================================
  // UPCOMING MOVIES ENDPOINTS
  // ============================================

  // Get upcoming movies (using TMDB's upcoming endpoint)
  async getUpcomingMovies(params: {
    language?: 'en-US' | 'ru-RU';
    page?: number;
    region?: 'US' | 'RU';
  } = {}): Promise<{ results: TMDBMovie[]; totalResults: number; totalPages: number }> {
    const queryParams: Record<string, string> = {
      language: params.language || 'en-US',
      page: String(params.page || 1),
    };

    if (params.region) {
      queryParams.region = params.region;
    }

    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/movie/upcoming', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
  }

  // Get movies with future release dates using discover endpoint (more control over date range)
  async discoverUpcomingMovies(params: {
    language?: 'en-US' | 'ru-RU';
    page?: number;
    daysAhead?: number; // How far into the future (default: 90)
    minPopularity?: number; // Filter by popularity threshold
  } = {}): Promise<{ results: TMDBMovie[]; totalResults: number; totalPages: number }> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(
      Date.now() + (params.daysAhead || 90) * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0];

    const queryParams: Record<string, string> = {
      language: params.language || 'en-US',
      page: String(params.page || 1),
      'primary_release_date.gte': today,
      'primary_release_date.lte': futureDate,
      sort_by: 'popularity.desc',
      include_adult: 'false',
    };

    if (params.minPopularity) {
      queryParams['vote_count.gte'] = '0'; // Include movies without votes
    }

    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/discover/movie', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
  }

  // Get detailed release dates for a movie (theatrical, digital, etc. for all regions)
  async getMovieReleaseDates(movieId: number): Promise<TMDBReleaseDates> {
    return this.fetch<TMDBReleaseDates>(`/movie/${movieId}/release_dates`);
  }

  // ============================================
  // TV SERIES ENDPOINTS
  // ============================================

  // Get top rated TV series
  async getTopRatedTV(
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<TMDBTVSeries[]> {
    const data = await this.fetch<TMDBResponse<TMDBTVSeries>>('/tv/top_rated', {
      language,
      page: page.toString(),
    });
    return data.results;
  }

  // Get popular TV series
  async getPopularTV(
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<TMDBTVSeries[]> {
    const data = await this.fetch<TMDBResponse<TMDBTVSeries>>('/tv/popular', {
      language,
      page: page.toString(),
    });
    return data.results;
  }

  // Get TV series details
  async getTVSeriesDetails(
    tvId: number,
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<TMDBTVSeriesDetails> {
    return this.fetch<TMDBTVSeriesDetails>(`/tv/${tvId}`, {
      language,
      append_to_response: 'external_ids',
    });
  }

  // Get TV season details with episodes
  async getSeasonDetails(
    tvId: number,
    seasonNumber: number,
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<TMDBSeason> {
    return this.fetch<TMDBSeason>(`/tv/${tvId}/season/${seasonNumber}`, {
      language,
    });
  }

  // Search TV series by title
  async searchTV(
    query: string,
    language: 'en-US' | 'ru-RU' = 'en-US',
    page = 1
  ): Promise<{ results: TMDBTVSeries[]; totalResults: number }> {
    const data = await this.fetch<TMDBResponse<TMDBTVSeries>>('/search/tv', {
      query,
      language,
      page: page.toString(),
      include_adult: 'false',
    });
    return {
      results: data.results,
      totalResults: data.total_results,
    };
  }

  // Get list of TV genres (cached for 24 hours)
  async getTVGenres(
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<{ id: number; name: string }[]> {
    const cacheKey = `tv:${language}`;
    const cached = getCachedGenres(cacheKey);
    if (cached) return cached;

    const data = await this.fetch<{ genres: { id: number; name: string }[] }>(
      '/genre/tv/list',
      { language }
    );
    setCachedGenres(cacheKey, data.genres);
    return data.genres;
  }

  // Discover TV series with filters
  async discoverTV(params: {
    genres?: number[];
    yearFrom?: number;
    yearTo?: number;
    ratingMin?: number;
    sortBy?: 'popularity.desc' | 'vote_average.desc' | 'first_air_date.desc' | 'vote_count.desc';
    page?: number;
    language?: 'en-US' | 'ru-RU';
    originalLanguage?: string; // ISO 639-1 code (en, ru, ko, ja, etc.)
  }): Promise<{ results: TMDBTVSeries[]; totalResults: number; totalPages: number }> {
    const queryParams: Record<string, string> = {
      language: params.language || 'en-US',
      page: String(params.page || 1),
      include_adult: 'false',
    };

    if (params.genres?.length) {
      queryParams.with_genres = params.genres.join(',');
    }
    if (params.yearFrom) {
      queryParams['first_air_date.gte'] = `${params.yearFrom}-01-01`;
    }
    if (params.yearTo) {
      queryParams['first_air_date.lte'] = `${params.yearTo}-12-31`;
    }
    if (params.ratingMin) {
      queryParams['vote_average.gte'] = String(params.ratingMin);
      queryParams['vote_count.gte'] = '100';
    }
    if (params.sortBy) {
      queryParams.sort_by = params.sortBy;
    }
    if (params.originalLanguage) {
      queryParams.with_original_language = params.originalLanguage;
    }

    const data = await this.fetch<TMDBResponse<TMDBTVSeries>>('/discover/tv', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
  }

  // Get videos (trailers) for a movie
  async getMovieVideos(movieId: number): Promise<TMDBVideo[]> {
    const data = await this.fetch<{ results: TMDBVideo[] }>(`/movie/${movieId}/videos`);
    // Filter to only YouTube trailers, prioritize official trailers
    return data.results
      .filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => {
        // Official trailers first
        if (a.official && !b.official) return -1;
        if (!a.official && b.official) return 1;
        // Then by type (Trailer > Teaser)
        if (a.type === 'Trailer' && b.type !== 'Trailer') return -1;
        if (a.type !== 'Trailer' && b.type === 'Trailer') return 1;
        return 0;
      });
  }

  // Get videos (trailers) for a TV series
  async getTVVideos(tvId: number): Promise<TMDBVideo[]> {
    const data = await this.fetch<{ results: TMDBVideo[] }>(`/tv/${tvId}/videos`);
    return data.results
      .filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => {
        if (a.official && !b.official) return -1;
        if (!a.official && b.official) return 1;
        if (a.type === 'Trailer' && b.type !== 'Trailer') return -1;
        if (a.type !== 'Trailer' && b.type === 'Trailer') return 1;
        return 0;
      });
  }

  // Static methods delegate to standalone functions from poster.ts
  // Kept for backward compatibility with existing code
  static getPosterUrl = getPosterUrl;
  static getBackdropUrl = getBackdropUrl;

  /**
   * Get smart poster URL with fallback logic (server-side only)
   * Priority: local file (if exists) > TMDB proxy > direct URL > fallback
   */
  static getSmartPosterUrl(
    localPosterPath: string | null | undefined,
    posterPath: string | null | undefined,
    posterUrl: string | null | undefined,
    size: PosterSize | TMDBPosterSize = 'medium'
  ): string {
    // Check local poster - verify file exists on server
    if (localPosterPath && typeof window === 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        const fullPath = path.join(process.cwd(), 'public', localPosterPath);
        if (fs.existsSync(fullPath)) {
          return localPosterPath;
        }
      } catch {
        // File doesn't exist or error checking, fall through to proxy
      }
    }

    // Use TMDB proxy if we have posterPath
    if (posterPath) {
      return getPosterUrl(posterPath, size);
    }

    // Direct URL (e.g. Kinopoisk)
    if (posterUrl) {
      return posterUrl;
    }

    return '/images/no-poster.svg';
  }
}

export const tmdb = new TMDBClient();
export { TMDBClient };
