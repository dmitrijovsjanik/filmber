import type { OMDBMovie, OMDBRating } from '@/types/movie';

const OMDB_BASE_URL = 'https://www.omdbapi.com/';

class OMDBClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OMDB_API_KEY || '';
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
}

export const omdb = new OMDBClient();
export { OMDBClient };
