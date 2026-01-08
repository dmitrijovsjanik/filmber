import type { TMDBMovie, TMDBMovieDetails } from '@/types/movie';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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

    const response = await fetch(url.toString(), {
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

  // Build poster URL
  static getPosterUrl(
    path: string | null,
    size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'
  ): string {
    if (!path) return '/images/no-poster.svg';
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }

  // Build backdrop URL
  static getBackdropUrl(
    path: string | null,
    size: 'w780' | 'w1280' | 'original' = 'w1280'
  ): string {
    if (!path) return '/images/no-backdrop.png';
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }
}

export const tmdb = new TMDBClient();
export { TMDBClient };
