import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { or, ilike } from 'drizzle-orm';
import { movieService } from '@/lib/services/movieService';
import type { SearchResult, SortOption, MediaTypeFilter, MediaType } from '@/types/movie';

// Timeout wrapper for API calls
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<{ data: T; timedOut: boolean }> {
  const timeout = new Promise<{ data: T; timedOut: boolean }>((resolve) =>
    setTimeout(() => resolve({ data: fallback, timedOut: true }), timeoutMs)
  );
  const result = promise.then((data) => ({ data, timedOut: false }));
  return Promise.race([result, timeout]);
}

// Bayesian rating formula (IMDB-style weighted rating)
function bayesianRating(movie: SearchResult): number {
  const R = parseFloat(movie.voteAverage || '0');
  const v = movie.voteCount || 0;
  const m = 100; // minimum votes for reliable rating
  const C = 6.5; // average rating across all movies
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

// Normalize ё -> е for Russian text comparison
const normalizeRu = (str: string) => str.toLowerCase().replace(/ё/g, 'е');

// Extract year from release date
const getYear = (movie: SearchResult) =>
  parseInt(movie.releaseDate?.substring(0, 4) || '0');

// Check if title starts with query as a complete word/phrase
// "Аватар: Путь воды" starts with "Аватар" ✓
// "Аватарка" does NOT start with "Аватар" as a word ✗
function startsWithWord(title: string, query: string): boolean {
  if (!title.startsWith(query)) return false;
  if (title.length === query.length) return true;
  // Check if next character is a word boundary (space, colon, dash, digit, etc.)
  const nextChar = title[query.length];
  return /[\s:.\-–—,!?0-9]/.test(nextChar);
}

// Check if title contains query as a complete word/phrase
function containsWord(title: string, query: string): boolean {
  if (title === query) return true;
  // Check various word boundary patterns
  const patterns = [
    new RegExp(`^${escapeRegex(query)}[\\s:.\-–—,!?0-9]`), // starts with
    new RegExp(`[\\s:.\-–—,!?]${escapeRegex(query)}[\\s:.\-–—,!?0-9]`), // middle
    new RegExp(`[\\s:.\-–—,!?]${escapeRegex(query)}$`), // ends with
  ];
  return patterns.some(p => p.test(title));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Calculate relevance score combining multiple factors
function calculateRelevanceScore(movie: SearchResult, query: string): number {
  const voteCount = movie.voteCount || 0;
  const popularity = movie.popularity || 0;
  const rating = parseFloat(movie.voteAverage || '0');

  // Normalized vote count using log scale (handles large numbers like 33000)
  // log(33001) ≈ 10.4, so max score ~10-11
  const normalizedVotes = voteCount > 0 ? Math.log(voteCount + 1) : 0;

  // Normalized popularity (cap at 500 for reasonable scaling)
  // Most movies have popularity < 100, blockbusters can reach 300-500
  const normalizedPopularity = Math.min(popularity, 500) / 50;

  // Title match quality - shorter titles that match query = better match
  const title = normalizeRu(movie.titleRu || movie.title || '');
  const queryNorm = normalizeRu(query);
  const titleLengthPenalty =
    title.length > queryNorm.length
      ? Math.max(0, 1 - (title.length - queryNorm.length) / 30)
      : 1;

  // Combined score with weights:
  // - 60% on vote count (historical popularity/quality indicator)
  // - 20% on current popularity (trending but can be misleading)
  // - 10% on rating (quality indicator)
  // - 10% on title match quality (shorter = more likely exact match)
  return (
    normalizedVotes * 6 +
    normalizedPopularity * 2 +
    rating +
    titleLengthPenalty * 10
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Parse filter parameters
  const genres = searchParams
    .get('genres')
    ?.split(',')
    .map(Number)
    .filter(Boolean) || [];
  const yearFrom = parseInt(searchParams.get('yearFrom') || '') || null;
  const yearTo = parseInt(searchParams.get('yearTo') || '') || null;
  const ratingMin = parseFloat(searchParams.get('ratingMin') || '') || null;
  const sortBy = (searchParams.get('sortBy') as SortOption) || 'relevance';
  const originalLanguages = searchParams.get('originalLanguages')?.split(',').filter(Boolean) || [];
  const runtimeMin = parseInt(searchParams.get('runtimeMin') || '') || null;
  const runtimeMax = parseInt(searchParams.get('runtimeMax') || '') || null;

  // Media type filter
  const mediaTypeParam = searchParams.get('mediaType');
  const validMediaTypes: MediaTypeFilter[] = ['all', 'movie', 'tv'];
  const mediaTypeFilter: MediaTypeFilter =
    mediaTypeParam && validMediaTypes.includes(mediaTypeParam as MediaTypeFilter)
      ? (mediaTypeParam as MediaTypeFilter)
      : 'all';

  const hasFilters = genres.length > 0 || yearFrom || yearTo || ratingMin || originalLanguages.length > 0 || runtimeMin || runtimeMax;

  // If no query and no filters, return empty
  if (!query && !hasFilters) {
    return NextResponse.json({
      tmdb: { results: [], totalResults: 0, page: 1, totalPages: 0 },
    });
  }

  try {
    // If no query but has filters, use discover endpoint
    if (!query && hasFilters) {
      const discoverSortMap: Record<SortOption, 'popularity.desc' | 'vote_average.desc' | 'release_date.desc' | 'vote_count.desc'> = {
        relevance: 'popularity.desc',
        popularity: 'popularity.desc',
        rating: 'vote_average.desc',
        date_desc: 'release_date.desc',
        date_asc: 'release_date.desc', // Will reverse client-side
      };

      // Make parallel requests for each selected language (or all if none selected)
      const languagesToFetch = originalLanguages.length > 0 ? originalLanguages : [null];

      const discoverPromises = languagesToFetch.flatMap((lang) => [
        tmdb.discoverMovies({
          genres: genres.length > 0 ? genres : undefined,
          yearFrom: yearFrom || undefined,
          yearTo: yearTo || undefined,
          ratingMin: ratingMin || undefined,
          sortBy: discoverSortMap[sortBy],
          page,
          language: 'en-US',
          originalLanguage: lang || undefined,
          runtimeMin: runtimeMin || undefined,
          runtimeMax: runtimeMax || undefined,
        }),
        tmdb.discoverMovies({
          genres: genres.length > 0 ? genres : undefined,
          yearFrom: yearFrom || undefined,
          yearTo: yearTo || undefined,
          ratingMin: ratingMin || undefined,
          sortBy: discoverSortMap[sortBy],
          page,
          language: 'ru-RU',
          originalLanguage: lang || undefined,
          runtimeMin: runtimeMin || undefined,
          runtimeMax: runtimeMax || undefined,
        }),
      ]);

      const discoverResults = await Promise.all(discoverPromises);

      // Merge and deduplicate results
      const seenIds = new Set<number>();
      const allResults: typeof discoverResults[0]['results'] = [];
      const ruDataMap = new Map<number, { title: string; overview: string }>();

      // First pass: collect Russian data
      discoverResults.forEach((result, index) => {
        if (index % 2 === 1) { // RU results
          result.results.forEach((r) => {
            ruDataMap.set(r.id, { title: r.title, overview: r.overview });
          });
        }
      });

      // Second pass: collect unique EN results
      discoverResults.forEach((result, index) => {
        if (index % 2 === 0) { // EN results
          result.results.forEach((r) => {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              allResults.push(r);
            }
          });
        }
      });

      // Use first result for pagination info
      const discoverEn = discoverResults[0];
      const totalResults = originalLanguages.length > 1
        ? allResults.length * discoverEn.totalPages // Approximate
        : discoverEn.totalResults;

      let results: SearchResult[] = allResults.map((r) => {
        const ruData = ruDataMap.get(r.id);
        return {
          tmdbId: r.id,
          imdbId: null,
          title: r.title,
          titleRu: ruData?.title || null,
          posterPath: r.poster_path,
          releaseDate: r.release_date,
          voteAverage: r.vote_average?.toString() || null,
          voteCount: r.vote_count || null,
          popularity: r.popularity || null,
          overview: r.overview,
          overviewRu: ruData?.overview || null,
          source: 'tmdb' as const,
          genreIds: r.genre_ids || null,
        };
      });

      // Reverse for date_asc since discover only supports desc
      if (sortBy === 'date_asc') {
        results = results.reverse();
      }

      return NextResponse.json(
        {
          tmdb: {
            results,
            totalResults: totalResults,
            page,
            totalPages: discoverEn.totalPages,
          },
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
          },
        }
      );
    }

    // Query-based search
    if (query.length < 2) {
      return NextResponse.json({
        tmdb: { results: [], totalResults: 0, page: 1, totalPages: 0 },
      });
    }

    // Normalize ё -> е for Russian search queries
    const normalizedQuery = query.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
    const hasYoChar = query !== normalizedQuery;

    // Search in parallel: local database + TMDB
    // Use timeout for TMDB to handle VPN/blocking issues
    const TMDB_TIMEOUT = 3000; // 3 seconds

    // Determine which TMDB searches to perform based on mediaTypeFilter
    const shouldSearchMovies = mediaTypeFilter === 'all' || mediaTypeFilter === 'movie';
    const shouldSearchTV = mediaTypeFilter === 'all' || mediaTypeFilter === 'tv';

    const [
      localResults,
      tmdbMovieEnResult,
      tmdbMovieRuResult,
      tmdbMovieEnNormResult,
      tmdbMovieRuNormResult,
      tmdbTVEnResult,
      tmdbTVRuResult,
      tmdbTVEnNormResult,
      tmdbTVRuNormResult,
    ] = await Promise.all([
      db
        .select()
        .from(movies)
        .where(
          or(
            ilike(movies.title, `%${query}%`),
            ilike(movies.titleRu, `%${query}%`)
          )
        )
        .limit(20)
        .catch(() => []),
      // TMDB Movies search
      shouldSearchMovies
        ? withTimeout(
            tmdb.searchMovies(query, 'en-US', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchMovies
        ? withTimeout(
            tmdb.searchMovies(query, 'ru-RU', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchMovies && hasYoChar
        ? withTimeout(
            tmdb.searchMovies(normalizedQuery, 'en-US', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchMovies && hasYoChar
        ? withTimeout(
            tmdb.searchMovies(normalizedQuery, 'ru-RU', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      // TMDB TV search
      shouldSearchTV
        ? withTimeout(
            tmdb.searchTV(query, 'en-US', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchTV
        ? withTimeout(
            tmdb.searchTV(query, 'ru-RU', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchTV && hasYoChar
        ? withTimeout(
            tmdb.searchTV(normalizedQuery, 'en-US', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      shouldSearchTV && hasYoChar
        ? withTimeout(
            tmdb.searchTV(normalizedQuery, 'ru-RU', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
    ]);

    // Extract TMDB data and check availability
    const tmdbMovieDataEn = tmdbMovieEnResult.data;
    const tmdbMovieDataRu = tmdbMovieRuResult.data;
    const tmdbMovieDataEnNorm = tmdbMovieEnNormResult.data;
    const tmdbMovieDataRuNorm = tmdbMovieRuNormResult.data;
    const tmdbTVDataEn = tmdbTVEnResult.data;
    const tmdbTVDataRu = tmdbTVRuResult.data;
    const tmdbTVDataEnNorm = tmdbTVEnNormResult.data;
    const tmdbTVDataRuNorm = tmdbTVRuNormResult.data;

    // Create sets for deduplication
    const localTmdbIds = new Set(localResults.filter((m) => m.tmdbId).map((m) => m.tmdbId));

    // Format local results as SearchResult
    const localSearchResults: SearchResult[] = localResults.map((m) => ({
      movieId: m.id,
      tmdbId: m.tmdbId,
      imdbId: m.imdbId,
      kinopoiskId: m.kinopoiskId,
      title: m.title,
      titleRu: m.titleRu,
      posterPath: m.posterPath,
      posterUrl: m.posterUrl,
      releaseDate: m.releaseDate,
      voteAverage: m.tmdbRating,
      voteCount: m.tmdbVoteCount,
      popularity: m.tmdbPopularity ? parseFloat(m.tmdbPopularity) : null,
      overview: m.overview,
      overviewRu: m.overviewRu,
      source: m.primarySource as 'tmdb' | 'omdb' | 'kinopoisk',
      runtime: m.runtime,
      genres: m.genres,
      genreIds: null,
      originalLanguage: m.originalLanguage,
      imdbRating: m.imdbRating,
      kinopoiskRating: m.kinopoiskRating,
      mediaType: (m.mediaType as MediaType) || 'movie',
      numberOfSeasons: m.numberOfSeasons,
      numberOfEpisodes: m.numberOfEpisodes,
    }));

    // Merge results from all sources (EN + RU + normalized variants)
    // RU API often returns more results for Russian queries
    const seenTmdbMovieIds = new Set<number>();
    const seenTmdbTVIds = new Set<number>();

    // Process MOVIES
    const allMovieEnResults = [...tmdbMovieDataEn.results, ...tmdbMovieDataEnNorm.results].filter((r) => {
      if (seenTmdbMovieIds.has(r.id)) return false;
      seenTmdbMovieIds.add(r.id);
      return true;
    });
    const allMovieRuResults = [...tmdbMovieDataRu.results, ...tmdbMovieDataRuNorm.results].filter((r) => {
      if (seenTmdbMovieIds.has(r.id)) return false;
      seenTmdbMovieIds.add(r.id);
      return true;
    });
    const movieRuDataMap = new Map(
      [...tmdbMovieDataRu.results, ...tmdbMovieDataRuNorm.results].map((r) => [r.id, { title: r.title, overview: r.overview }])
    );
    const allUniqueMovies = [...allMovieEnResults, ...allMovieRuResults];
    const newTmdbMovies = allUniqueMovies.filter((r) => !localTmdbIds.has(r.id));

    // Process TV SERIES
    const allTVEnResults = [...tmdbTVDataEn.results, ...tmdbTVDataEnNorm.results].filter((r) => {
      if (seenTmdbTVIds.has(r.id)) return false;
      seenTmdbTVIds.add(r.id);
      return true;
    });
    const allTVRuResults = [...tmdbTVDataRu.results, ...tmdbTVDataRuNorm.results].filter((r) => {
      if (seenTmdbTVIds.has(r.id)) return false;
      seenTmdbTVIds.add(r.id);
      return true;
    });
    const tvRuDataMap = new Map(
      [...tmdbTVDataRu.results, ...tmdbTVDataRuNorm.results].map((r) => [r.id, { name: r.name, overview: r.overview }])
    );
    const allUniqueTV = [...allTVEnResults, ...allTVRuResults];

    // Fetch genre mappings for both movies and TV (in parallel)
    const [movieGenresEn, movieGenresRu, tvGenresEn, tvGenresRu] = await Promise.all([
      tmdb.getGenres('en-US').catch(() => []),
      tmdb.getGenres('ru-RU').catch(() => []),
      tmdb.getTVGenres('en-US').catch(() => []),
      tmdb.getTVGenres('ru-RU').catch(() => []),
    ]);

    // Create genre ID to name mappings (prefer Russian names)
    const movieGenreMap = new Map<number, string>();
    movieGenresEn.forEach((g) => movieGenreMap.set(g.id, g.name));
    movieGenresRu.forEach((g) => movieGenreMap.set(g.id, g.name)); // Override with Russian

    const tvGenreMap = new Map<number, string>();
    tvGenresEn.forEach((g) => tvGenreMap.set(g.id, g.name));
    tvGenresRu.forEach((g) => tvGenreMap.set(g.id, g.name)); // Override with Russian

    // Helper to capitalize first letter
    const capitalize = (str: string): string => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Helper to convert genre IDs to JSON string of names
    const genreIdsToNames = (ids: number[] | null, genreMap: Map<number, string>): string | null => {
      if (!ids || ids.length === 0) return null;
      const names: string[] = [];
      ids.forEach((id) => {
        const genre = genreMap.get(id);
        if (genre) {
          names.push(capitalize(genre));
        }
      });
      return names.length > 0 ? JSON.stringify(names) : null;
    };

    // Format new TMDB MOVIE results with genre names
    const tmdbMovieSearchResults: SearchResult[] = newTmdbMovies.map((r) => {
      const ruData = movieRuDataMap.get(r.id);
      return {
        tmdbId: r.id,
        imdbId: null,
        title: r.title,
        titleRu: ruData?.title || null,
        posterPath: r.poster_path,
        releaseDate: r.release_date,
        voteAverage: r.vote_average?.toString() || null,
        voteCount: r.vote_count || null,
        popularity: r.popularity || null,
        overview: r.overview,
        overviewRu: ruData?.overview || null,
        source: 'tmdb' as const,
        genreIds: r.genre_ids || null,
        genres: genreIdsToNames(r.genre_ids, movieGenreMap),
        originalLanguage: r.original_language || null,
        mediaType: 'movie' as const,
      };
    });

    // Format new TMDB TV results with genre names (seasons/episodes will be fetched after sorting)
    const tmdbTVSearchResults: SearchResult[] = allUniqueTV.map((r) => {
      const ruData = tvRuDataMap.get(r.id);
      return {
        tmdbId: r.id,
        imdbId: null,
        title: r.name,
        titleRu: ruData?.name || null,
        posterPath: r.poster_path,
        releaseDate: r.first_air_date,
        voteAverage: r.vote_average?.toString() || null,
        voteCount: r.vote_count || null,
        popularity: r.popularity || null,
        overview: r.overview,
        overviewRu: ruData?.overview || null,
        source: 'tmdb' as const,
        genreIds: r.genre_ids || null,
        genres: genreIdsToNames(r.genre_ids, tvGenreMap),
        originalLanguage: r.original_language || null,
        mediaType: 'tv' as const,
        numberOfSeasons: null,
        numberOfEpisodes: null,
      };
    });

    // Combine movie and TV results
    const tmdbSearchResults: SearchResult[] = [...tmdbMovieSearchResults, ...tmdbTVSearchResults];

    let allTmdbResults = [...localSearchResults, ...tmdbSearchResults];

    // Apply mediaType filter (filter out results that don't match)
    if (mediaTypeFilter !== 'all') {
      allTmdbResults = allTmdbResults.filter((m) => m.mediaType === mediaTypeFilter);
    }

    // Apply client-side filters
    if (genres.length > 0) {
      allTmdbResults = allTmdbResults.filter((movie) => {
        // Check genreIds first (TMDB results)
        if (movie.genreIds && movie.genreIds.length > 0) {
          return genres.some((gId) => movie.genreIds?.includes(gId));
        }
        // For local cache results with genres string, try to match by ID in parsed array
        if (movie.genres) {
          try {
            const parsed = JSON.parse(movie.genres);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Check if it's the new format with objects containing id
              if (typeof parsed[0] === 'object' && parsed[0] !== null && 'id' in parsed[0]) {
                return genres.some((gId) => parsed.some((g: { id: number }) => g.id === gId));
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        // Exclude items without genre info when filtering by genre
        return false;
      });
    }

    if (yearFrom) {
      allTmdbResults = allTmdbResults.filter((m) => getYear(m) >= yearFrom);
    }

    if (yearTo) {
      allTmdbResults = allTmdbResults.filter((m) => {
        const year = getYear(m);
        return year === 0 || year <= yearTo;
      });
    }

    if (ratingMin) {
      allTmdbResults = allTmdbResults.filter((m) => {
        const rating = parseFloat(m.voteAverage || '0');
        return rating >= ratingMin;
      });
    }

    // Filter by original language
    if (originalLanguages.length > 0) {
      const DEFAULT_LANGS = ['en', 'ru'];
      // Check if user has all default languages (for backwards compatibility with old data without originalLanguage)
      const hasAllDefaultLangs = DEFAULT_LANGS.every(lang => originalLanguages.includes(lang));

      allTmdbResults = allTmdbResults.filter((m) => {
        // If movie has no language info:
        // - Keep if user has all default languages selected (backwards compatible)
        // - Exclude if user narrowed search (removed some default languages)
        if (!m.originalLanguage) return hasAllDefaultLangs;
        return originalLanguages.includes(m.originalLanguage);
      });
    }

    // Filter out results that don't contain the query at all
    // TMDB sometimes returns loosely related results
    const queryNormForFilter = normalizeRu(query);
    allTmdbResults = allTmdbResults.filter((m) => {
      // Normalize both titles (ё → е) since RU API may return Russian text in 'title' field
      const titleRu = normalizeRu(m.titleRu || '');
      const titleEn = normalizeRu(m.title || '');
      // Keep if either title contains query
      return titleRu.includes(queryNormForFilter) || titleEn.includes(queryNormForFilter);
    });

    // Extract episode/part number from title for franchise sorting
    const extractEpisodeNumber = (title: string): number | null => {
      const romanToArabic: Record<string, number> = {
        i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
        xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15,
      };

      const lowerTitle = title.toLowerCase();
      const episodePatterns = [
        /(?:episode|эпизод|part|часть)\s+([ivxlcdm]+|\d+)/i,
        /([ivxlcdm]+|\d+)\s*[-:]\s/i,
        /\s(\d+)$/,
      ];

      for (const pattern of episodePatterns) {
        const match = lowerTitle.match(pattern);
        if (match) {
          const numStr = match[1].toLowerCase();
          if (romanToArabic[numStr]) return romanToArabic[numStr];
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > 0 && num < 100) return num;
        }
      }
      return null;
    };

    // Relevance sort function (default)
    const relevanceSort = (a: SearchResult, b: SearchResult): number => {
      const queryNorm = normalizeRu(query);
      const titleA = normalizeRu(a.titleRu || a.title || '');
      const titleB = normalizeRu(b.titleRu || b.title || '');
      const titleEnA = (a.title || '').toLowerCase();
      const titleEnB = (b.title || '').toLowerCase();

      // 1. Exact match (highest priority)
      const exactMatchA = titleA === queryNorm || titleEnA === queryNorm;
      const exactMatchB = titleB === queryNorm || titleEnB === queryNorm;
      if (exactMatchA && !exactMatchB) return -1;
      if (exactMatchB && !exactMatchA) return 1;

      // 2. Starts with query as a complete word (not partial match)
      // "Аватар: Путь воды" ✓, "Аватарка" ✗
      const startsWithA = startsWithWord(titleA, queryNorm) || startsWithWord(titleEnA, queryNorm);
      const startsWithB = startsWithWord(titleB, queryNorm) || startsWithWord(titleEnB, queryNorm);
      if (startsWithA && !startsWithB) return -1;
      if (startsWithB && !startsWithA) return 1;

      // 3. Contains query as a complete word (for titles like "Изгой-один: Звёздные войны")
      const containsA = containsWord(titleA, queryNorm) || containsWord(titleEnA, queryNorm);
      const containsB = containsWord(titleB, queryNorm) || containsWord(titleEnB, queryNorm);
      if (containsA && !containsB) return -1;
      if (containsB && !containsA) return 1;

      // 4. Episode number within same franchise (sort episodes 1,2,3... before score)
      // Only if both movies start with the same prefix (same franchise)
      const episodeA = extractEpisodeNumber(a.titleRu || a.title || '');
      const episodeB = extractEpisodeNumber(b.titleRu || b.title || '');

      // Check if two movies belong to the same franchise
      // Uses query as the franchise identifier - if both titles start with query, they're same franchise
      const startsWithQueryA = startsWithWord(titleA, queryNorm) || startsWithWord(titleEnA, queryNorm);
      const startsWithQueryB = startsWithWord(titleB, queryNorm) || startsWithWord(titleEnB, queryNorm);
      const sameFranchise = startsWithQueryA && startsWithQueryB && queryNorm.length >= 3;

      if (sameFranchise) {
        // For same franchise, sort chronologically first
        const yearDiff = getYear(a) - getYear(b);
        if (yearDiff !== 0) return yearDiff;
        // Same year - use episode number if both have it (e.g., "Часть I" vs "Часть II")
        if (episodeA !== null && episodeB !== null) {
          return episodeA - episodeB;
        }
      }

      // 5. Combined relevance score (vote count + popularity + rating + title match)
      const scoreA = calculateRelevanceScore(a, query);
      const scoreB = calculateRelevanceScore(b, query);
      if (Math.abs(scoreA - scoreB) > 0.1) return scoreB - scoreA;

      // 6. For movies without episode numbers, prefer those with episodes first
      if (episodeA !== null && episodeB === null) return -1;
      if (episodeB !== null && episodeA === null) return 1;

      // 7. Release date (older = original, show first)
      return getYear(a) - getYear(b);
    };

    // Apply sorting based on sortBy parameter
    const sortFunctions: Record<SortOption, (a: SearchResult, b: SearchResult) => number> = {
      relevance: relevanceSort,
      popularity: (a, b) => (b.popularity || 0) - (a.popularity || 0),
      rating: (a, b) => bayesianRating(b) - bayesianRating(a),
      date_desc: (a, b) => getYear(b) - getYear(a),
      date_asc: (a, b) => getYear(a) - getYear(b),
    };

    let combinedTmdbResults = allTmdbResults.sort(sortFunctions[sortBy]);

    // Fetch TV details for seasons/episodes AFTER sorting (for top 15 TV results)
    const tvResultsNeedingDetails = combinedTmdbResults
      .filter((r) => r.mediaType === 'tv' && r.numberOfSeasons === null && r.tmdbId)
      .slice(0, 15);

    if (tvResultsNeedingDetails.length > 0) {
      const tvDetailsResults = await Promise.all(
        tvResultsNeedingDetails.map((r) =>
          tmdb.getTVSeriesDetails(r.tmdbId!, 'en-US')
            .then((details) => ({ tmdbId: r.tmdbId, details }))
            .catch(() => null)
        )
      );

      const tvDetailsMap = new Map<number, { numberOfSeasons: number; numberOfEpisodes: number }>();
      tvDetailsResults.forEach((result) => {
        if (result && result.details && result.tmdbId) {
          tvDetailsMap.set(result.tmdbId, {
            numberOfSeasons: result.details.number_of_seasons,
            numberOfEpisodes: result.details.number_of_episodes,
          });
        }
      });

      // Update results with TV details
      combinedTmdbResults = combinedTmdbResults.map((r) => {
        if (r.mediaType === 'tv' && r.tmdbId && tvDetailsMap.has(r.tmdbId)) {
          const details = tvDetailsMap.get(r.tmdbId)!;
          return {
            ...r,
            numberOfSeasons: details.numberOfSeasons,
            numberOfEpisodes: details.numberOfEpisodes,
          };
        }
        return r;
      });
    }

    // Cache new movies in background using movieService
    if (newTmdbMovies.length > 0) {
      Promise.all(
        newTmdbMovies.slice(0, 10).map((movie) =>
          movieService.findOrCreate({ tmdbId: movie.id, source: 'tmdb' })
        )
      ).catch((err) => console.error('Failed to cache search results:', err));
    }

    // Calculate total results from both movies and TV
    const tmdbTotalResults = tmdbMovieDataEn.totalResults + tmdbTVDataEn.totalResults;
    const totalPages = Math.ceil(tmdbTotalResults / 20);

    return NextResponse.json(
      {
        tmdb: {
          results: combinedTmdbResults,
          totalResults: tmdbTotalResults,
          page,
          totalPages,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      tmdb: { results: [], totalResults: 0, page: 1, totalPages: 0 },
    });
  }
}
