import type {
  KinopoiskFilm,
  KinopoiskSearchResult,
  KinopoiskSearchResponse,
  MediaType,
  MediaTypeFilter,
} from '@/types/movie';

const KINOPOISK_BASE_URL = 'https://kinopoiskapiunofficial.tech/api';

// Kinopoisk type to our MediaType mapping
type KinopoiskType = 'FILM' | 'TV_SERIES' | 'TV_SHOW' | 'MINI_SERIES' | 'VIDEO';

function mapKinopoiskTypeToMediaType(type: KinopoiskType): MediaType {
  return type === 'FILM' ? 'movie' : 'tv';
}

function filterByMediaType<T extends { type: KinopoiskType }>(
  items: T[],
  mediaType: MediaTypeFilter
): T[] {
  if (mediaType === 'all') {
    // Include movies and all TV types, exclude VIDEO
    return items.filter((f) => f.type !== 'VIDEO');
  }
  if (mediaType === 'movie') {
    return items.filter((f) => f.type === 'FILM');
  }
  // tv - include all TV types
  return items.filter((f) => ['TV_SERIES', 'TV_SHOW', 'MINI_SERIES'].includes(f.type));
}

class KinopoiskClient {
  // Read API key lazily at request time to ensure env vars are loaded
  private get apiKey(): string {
    return process.env.KINOPOISK_API_KEY || '';
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Kinopoisk API key not configured');
    }

    const response = await fetch(`${KINOPOISK_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Kinopoisk API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Search movies/TV series by keyword
   * GET /api/v2.1/films/search-by-keyword
   */
  async searchMovies(
    query: string,
    page = 1,
    mediaType: MediaTypeFilter = 'all'
  ): Promise<{ results: KinopoiskSearchResult[]; totalResults: number; totalPages: number }> {
    if (!this.apiKey) {
      return { results: [], totalResults: 0, totalPages: 0 };
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const data = await this.fetch<KinopoiskSearchResponse>(
        `/v2.1/films/search-by-keyword?keyword=${encodedQuery}&page=${page}`
      );

      // Filter by media type
      const filtered = filterByMediaType(data.films, mediaType);

      return {
        results: filtered,
        totalResults: data.searchFilmsCountResult,
        totalPages: data.pagesCount,
      };
    } catch (error) {
      console.error('Kinopoisk search error:', error);
      return { results: [], totalResults: 0, totalPages: 0 };
    }
  }

  /**
   * Get movie details by Kinopoisk ID
   * GET /api/v2.2/films/{id}
   */
  async getMovieDetails(kinopoiskId: number): Promise<KinopoiskFilm | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      return await this.fetch<KinopoiskFilm>(`/v2.2/films/${kinopoiskId}`);
    } catch (error) {
      console.error('Kinopoisk details error:', error);
      return null;
    }
  }

  /**
   * Get top rated movies
   * GET /api/v2.2/films/top?type=TOP_250_BEST_FILMS
   */
  async getTopRated(page = 1, mediaType: MediaTypeFilter = 'all'): Promise<KinopoiskSearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const data = await this.fetch<{ films: KinopoiskSearchResult[] }>(
        `/v2.2/films/top?type=TOP_250_BEST_FILMS&page=${page}`
      );
      return filterByMediaType(data.films, mediaType);
    } catch (error) {
      console.error('Kinopoisk top rated error:', error);
      return [];
    }
  }

  /**
   * Get popular movies (top 100)
   * GET /api/v2.2/films/top?type=TOP_100_POPULAR_FILMS
   */
  async getPopular(page = 1, mediaType: MediaTypeFilter = 'all'): Promise<KinopoiskSearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const data = await this.fetch<{ films: KinopoiskSearchResult[] }>(
        `/v2.2/films/top?type=TOP_100_POPULAR_FILMS&page=${page}`
      );
      return filterByMediaType(data.films, mediaType);
    } catch (error) {
      console.error('Kinopoisk popular error:', error);
      return [];
    }
  }

  /**
   * Discover movies/TV series with filters
   * GET /api/v2.2/films
   */
  async discoverMovies(params: {
    genres?: number[];
    yearFrom?: number;
    yearTo?: number;
    ratingFrom?: number;
    order?: 'RATING' | 'NUM_VOTE' | 'YEAR';
    page?: number;
    mediaType?: MediaTypeFilter;
  }): Promise<{ results: KinopoiskSearchResult[]; totalResults: number; totalPages: number }> {
    if (!this.apiKey) {
      return { results: [], totalResults: 0, totalPages: 0 };
    }

    const mediaTypeFilter = params.mediaType || 'all';

    try {
      const queryParams = new URLSearchParams();
      // Set Kinopoisk type based on mediaType filter
      if (mediaTypeFilter === 'movie') {
        queryParams.set('type', 'FILM');
      } else if (mediaTypeFilter === 'tv') {
        queryParams.set('type', 'TV_SERIES');
      }
      // For 'all', don't set type to get all content
      queryParams.set('page', String(params.page || 1));

      if (params.genres?.length) {
        queryParams.set('genres', params.genres.join(','));
      }
      if (params.yearFrom) {
        queryParams.set('yearFrom', String(params.yearFrom));
      }
      if (params.yearTo) {
        queryParams.set('yearTo', String(params.yearTo));
      }
      if (params.ratingFrom) {
        queryParams.set('ratingFrom', String(params.ratingFrom));
      }
      if (params.order) {
        queryParams.set('order', params.order);
      }

      const data = await this.fetch<{
        items: KinopoiskSearchResult[];
        total: number;
        totalPages: number;
      }>(`/v2.2/films?${queryParams.toString()}`);

      return {
        results: filterByMediaType(data.items, mediaTypeFilter),
        totalResults: data.total,
        totalPages: data.totalPages,
      };
    } catch (error) {
      console.error('Kinopoisk discover error:', error);
      return { results: [], totalResults: 0, totalPages: 0 };
    }
  }

  /**
   * Check if API is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${KINOPOISK_BASE_URL}/v2.2/films/1`, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Build poster URL (Kinopoisk returns full URLs)
   */
  static getPosterUrl(posterUrl: string | null): string {
    return posterUrl || '/images/no-poster.svg';
  }
}

export const kinopoisk = new KinopoiskClient();
export { KinopoiskClient, mapKinopoiskTypeToMediaType };
