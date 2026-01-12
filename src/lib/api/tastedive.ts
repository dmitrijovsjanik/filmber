const TASTEDIVE_BASE_URL = 'https://tastedive.com/api/similar';

export interface TasteDiveResult {
  Name: string;
  Type: string;
  wTeaser?: string; // Wikipedia description
  wUrl?: string; // Wikipedia URL
  yUrl?: string; // YouTube URL
  yID?: string; // YouTube ID
}

interface TasteDiveResponse {
  Similar: {
    Info: TasteDiveResult[];
    Results: TasteDiveResult[];
  };
}

class TasteDiveClient {
  private _apiKey: string | null = null;

  private get apiKey(): string {
    if (!this._apiKey) {
      this._apiKey = process.env.TASTEDIVE_API_KEY || '';
    }
    return this._apiKey;
  }

  async getSimilarMovies(
    movieTitle: string,
    limit = 8
  ): Promise<TasteDiveResult[]> {
    if (!this.apiKey) {
      console.warn('TasteDive API key not configured');
      return [];
    }

    const url = new URL(TASTEDIVE_BASE_URL);
    url.searchParams.set('q', `movie:${movieTitle}`);
    url.searchParams.set('type', 'movie');
    url.searchParams.set('info', '1');
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('k', this.apiKey);

    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 86400 }, // Cache for 24 hours
      });

      if (!response.ok) {
        throw new Error(`TasteDive API error: ${response.status}`);
      }

      const data: TasteDiveResponse = await response.json();
      return data.Similar?.Results || [];
    } catch (error) {
      console.error('TasteDive API error:', error);
      return [];
    }
  }
}

export const tastedive = new TasteDiveClient();
export { TasteDiveClient };
