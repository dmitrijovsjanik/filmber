import type { OMDBMovie, OMDBRating, OMDBSearchResult, OMDBSearchResponse } from '@/types/movie';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

class OMDBClient {
  // Read API key lazily at request time to ensure env vars are loaded
  private get apiKey(): string {
    return process.env.OMDB_API_KEY || '';
  }

  async getByImdbId(imdbId: string): Promise<OMDBMovie | null> {
    if (!this.apiKey) {
      console.warn('OMDB API key not configured');
      return null;
    }

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('i', imdbId);

    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 86400 }, // Cache for 24 hours
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.Response === 'False') return null;

      return data;
    } catch (error) {
      console.error('OMDB fetch error:', error);
      return null;
    }
  }

  // Extract Rotten Tomatoes rating from OMDB ratings array
  static getRottenTomatoesRating(ratings: OMDBRating[]): string | null {
    const rt = ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    return rt?.Value || null;
  }

  // Extract Metacritic rating from OMDB ratings array
  static getMetacriticRating(ratings: OMDBRating[]): string | null {
    const mc = ratings?.find((r) => r.Source === 'Metacritic');
    return mc?.Value || null;
  }

  // Check if query contains Cyrillic characters
  private hasCyrillic(str: string): boolean {
    return /[а-яА-ЯёЁ]/.test(str);
  }

  // Search movies by title
  async searchMovies(query: string): Promise<{ results: OMDBSearchResult[]; totalResults: number }> {
    if (!this.apiKey) {
      console.warn('OMDB API key not configured');
      return { results: [], totalResults: 0 };
    }

    // OMDB doesn't support Cyrillic queries - skip for Russian text
    if (this.hasCyrillic(query)) {
      return { results: [], totalResults: 0 };
    }

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('s', query);
    url.searchParams.set('type', 'movie');

    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
      });

      if (!response.ok) return { results: [], totalResults: 0 };

      const data: OMDBSearchResponse = await response.json();

      if (data.Response === 'False') {
        return { results: [], totalResults: 0 };
      }

      return {
        results: data.Search || [],
        totalResults: parseInt(data.totalResults || '0', 10),
      };
    } catch (error) {
      console.error('OMDB search error:', error);
      return { results: [], totalResults: 0 };
    }
  }
}

export const omdb = new OMDBClient();
export { OMDBClient };
