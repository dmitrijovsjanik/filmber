/**
 * Tests for TMDB client genre caching
 *
 * The genre cache stores genres in memory for 24 hours to reduce API calls.
 * Genres rarely change, so this is a safe optimization.
 */

// Mock the undici module before importing tmdb
jest.mock('undici', () => ({
  ProxyAgent: jest.fn(),
  fetch: jest.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, TMDB_ACCESS_TOKEN: 'test-token' };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

describe('TMDB Client - Genre Caching', () => {
  let tmdb: typeof import('../tmdb').tmdb;
  let mockFetch: jest.Mock;

  const mockMovieGenres = [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 35, name: 'Comedy' },
  ];

  const mockTVGenres = [
    { id: 10759, name: 'Action & Adventure' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
  ];

  beforeEach(async () => {
    // Reset module cache to get fresh tmdb instance with clean genre cache
    jest.resetModules();

    // Setup mock fetch
    mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/genre/movie/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ genres: mockMovieGenres }),
        });
      }
      if (url.includes('/genre/tv/list')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ genres: mockTVGenres }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Mock global fetch
    global.fetch = mockFetch;

    // Import fresh tmdb instance
    const tmdbModule = await import('../tmdb');
    tmdb = tmdbModule.tmdb;
  });

  describe('getGenres (movie genres)', () => {
    it('should fetch genres from API on first call', async () => {
      const genres = await tmdb.getGenres('en-US');

      expect(genres).toEqual(mockMovieGenres);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/genre/movie/list'),
        expect.any(Object)
      );
    });

    it('should return cached genres on subsequent calls', async () => {
      // First call - should fetch
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const genres = await tmdb.getGenres('en-US');
      expect(genres).toEqual(mockMovieGenres);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, no new fetch
    });

    it('should cache separately for different languages', async () => {
      // Fetch EN genres
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fetch RU genres - should make new request
      await tmdb.getGenres('ru-RU');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Fetch EN again - should use cache
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2

      // Fetch RU again - should use cache
      await tmdb.getGenres('ru-RU');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('getTVGenres', () => {
    it('should fetch TV genres from API on first call', async () => {
      const genres = await tmdb.getTVGenres('en-US');

      expect(genres).toEqual(mockTVGenres);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/genre/tv/list'),
        expect.any(Object)
      );
    });

    it('should return cached TV genres on subsequent calls', async () => {
      await tmdb.getTVGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const genres = await tmdb.getTVGenres('en-US');
      expect(genres).toEqual(mockTVGenres);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should cache movie and TV genres separately', async () => {
      // Fetch movie genres
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fetch TV genres - should make new request
      await tmdb.getTVGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Both should be cached now
      await tmdb.getGenres('en-US');
      await tmdb.getTVGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache expiration', () => {
    it('should refetch after cache expires (24 hours)', async () => {
      // First fetch
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time by 25 hours (past 24h TTL)
      const realDateNow = Date.now;
      Date.now = jest.fn(() => realDateNow() + 25 * 60 * 60 * 1000);

      // Should refetch because cache expired
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Restore Date.now
      Date.now = realDateNow;
    });

    it('should use cache within 24 hours', async () => {
      // First fetch
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time by 23 hours (still within TTL)
      const realDateNow = Date.now;
      Date.now = jest.fn(() => realDateNow() + 23 * 60 * 60 * 1000);

      // Should use cache
      await tmdb.getGenres('en-US');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Restore Date.now
      Date.now = realDateNow;
    });
  });
});
