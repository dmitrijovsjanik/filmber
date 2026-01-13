import type { TMDBMovie, TMDBMovieDetails, TMDBTVSeries, TMDBTVSeriesDetails } from '@/types/movie';
import { ProxyAgent, fetch as proxyFetch } from 'undici';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// HTTP proxy for TMDB requests (v2ray on server)
const TMDB_PROXY_URL = process.env.TMDB_PROXY_URL;

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

  // Get list of movie genres
  async getGenres(
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<{ id: number; name: string }[]> {
    const data = await this.fetch<{ genres: { id: number; name: string }[] }>(
      '/genre/movie/list',
      { language }
    );
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

    const data = await this.fetch<TMDBResponse<TMDBMovie>>('/discover/movie', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
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

  // Get list of TV genres
  async getTVGenres(
    language: 'en-US' | 'ru-RU' = 'en-US'
  ): Promise<{ id: number; name: string }[]> {
    const data = await this.fetch<{ genres: { id: number; name: string }[] }>(
      '/genre/tv/list',
      { language }
    );
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

    const data = await this.fetch<TMDBResponse<TMDBTVSeries>>('/discover/tv', queryParams);
    return {
      results: data.results,
      totalResults: data.total_results,
      totalPages: data.total_pages,
    };
  }

  // Build poster URL - uses proxy endpoint on server to bypass geo-blocking
  static getPosterUrl(
    path: string | null,
    size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'
  ): string {
    if (!path) return '/images/no-poster.svg';
    // Use proxy endpoint to route through server's v2ray
    return `/api/tmdb-image?path=${encodeURIComponent(path)}&size=${size}`;
  }

  /**
   * Get smart poster URL with fallback logic
   * Priority: local file (if exists) > TMDB proxy > direct URL > fallback
   */
  static getSmartPosterUrl(
    localPosterPath: string | null | undefined,
    posterPath: string | null | undefined,
    posterUrl: string | null | undefined,
    size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'
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
      return TMDBClient.getPosterUrl(posterPath, size);
    }

    // Direct URL (e.g. Kinopoisk)
    if (posterUrl) {
      return posterUrl;
    }

    return '/images/no-poster.svg';
  }

  // Build backdrop URL - uses proxy endpoint on server to bypass geo-blocking
  static getBackdropUrl(
    path: string | null,
    size: 'w780' | 'w1280' | 'original' = 'w1280'
  ): string {
    if (!path) return '/images/no-backdrop.png';
    // Use proxy endpoint to route through server's v2ray
    return `/api/tmdb-image?path=${encodeURIComponent(path)}&size=${size}`;
  }
}

export const tmdb = new TMDBClient();
export { TMDBClient };
