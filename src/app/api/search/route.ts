import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';
import { omdb } from '@/lib/api/omdb';
import { kinopoisk } from '@/lib/api/kinopoisk';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { or, ilike } from 'drizzle-orm';
import { movieService } from '@/lib/services/movieService';
import type { SearchResult, SortOption, KinopoiskSearchResult } from '@/types/movie';

// API availability status
interface SourceStatus {
  tmdb: boolean;
  omdb: boolean;
  kinopoisk: boolean;
}

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

// Convert Kinopoisk result to SearchResult
function kinopoiskToSearchResult(kp: KinopoiskSearchResult): SearchResult {
  return {
    tmdbId: null,
    imdbId: kp.imdbId,
    kinopoiskId: kp.kinopoiskId,
    title: kp.nameOriginal || kp.nameEn || kp.nameRu || 'Unknown',
    titleRu: kp.nameRu,
    posterPath: null,
    posterUrl: kp.posterUrlPreview || kp.posterUrl,
    releaseDate: kp.year?.toString() || null,
    voteAverage: kp.ratingKinopoisk?.toString() || null,
    voteCount: null,
    popularity: null,
    overview: null,
    overviewRu: null,
    source: 'kinopoisk',
    kinopoiskRating: kp.ratingKinopoisk?.toString(),
    imdbRating: kp.ratingImdb?.toString(),
  };
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

  const hasFilters = genres.length > 0 || yearFrom || yearTo || ratingMin;

  // If no query and no filters, return empty
  if (!query && !hasFilters) {
    return NextResponse.json({
      tmdb: { results: [], totalResults: 0, page: 1, totalPages: 0 },
      omdb: { results: [], totalResults: 0 },
      kinopoisk: { results: [], totalResults: 0, totalPages: 0 },
      sourceStatus: { tmdb: true, omdb: true, kinopoisk: true },
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

      const [discoverEn, discoverRu] = await Promise.all([
        tmdb.discoverMovies({
          genres: genres.length > 0 ? genres : undefined,
          yearFrom: yearFrom || undefined,
          yearTo: yearTo || undefined,
          ratingMin: ratingMin || undefined,
          sortBy: discoverSortMap[sortBy],
          page,
          language: 'en-US',
        }),
        tmdb.discoverMovies({
          genres: genres.length > 0 ? genres : undefined,
          yearFrom: yearFrom || undefined,
          yearTo: yearTo || undefined,
          ratingMin: ratingMin || undefined,
          sortBy: discoverSortMap[sortBy],
          page,
          language: 'ru-RU',
        }),
      ]);

      const ruDataMap = new Map(
        discoverRu.results.map((r) => [r.id, { title: r.title, overview: r.overview }])
      );

      let results: SearchResult[] = discoverEn.results.map((r) => {
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
            totalResults: discoverEn.totalResults,
            page,
            totalPages: discoverEn.totalPages,
          },
          omdb: { results: [], totalResults: 0 },
          kinopoisk: { results: [], totalResults: 0, totalPages: 0 },
          sourceStatus: { tmdb: true, omdb: true, kinopoisk: true },
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
        omdb: { results: [], totalResults: 0 },
        kinopoisk: { results: [], totalResults: 0, totalPages: 0 },
        sourceStatus: { tmdb: true, omdb: true, kinopoisk: true },
      });
    }

    // Normalize ё -> е for Russian search queries
    const normalizedQuery = query.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
    const hasYoChar = query !== normalizedQuery;

    // Search in parallel: local database + TMDB + OMDB + Kinopoisk
    // Use timeout for TMDB to handle VPN/blocking issues
    const TMDB_TIMEOUT = 3000; // 3 seconds

    const [
      localResults,
      tmdbEnResult,
      tmdbRuResult,
      tmdbEnNormResult,
      tmdbRuNormResult,
      omdbData,
      kinopoiskData,
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
      withTimeout(
        tmdb.searchMovies(query, 'en-US', page),
        TMDB_TIMEOUT,
        { results: [], totalResults: 0 }
      ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true })),
      withTimeout(
        tmdb.searchMovies(query, 'ru-RU', page),
        TMDB_TIMEOUT,
        { results: [], totalResults: 0 }
      ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true })),
      hasYoChar
        ? withTimeout(
            tmdb.searchMovies(normalizedQuery, 'en-US', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      hasYoChar
        ? withTimeout(
            tmdb.searchMovies(normalizedQuery, 'ru-RU', page),
            TMDB_TIMEOUT,
            { results: [], totalResults: 0 }
          ).catch(() => ({ data: { results: [], totalResults: 0 }, timedOut: true }))
        : Promise.resolve({ data: { results: [], totalResults: 0 }, timedOut: false }),
      omdb.searchMovies(query).catch(() => ({ results: [], totalResults: 0 })),
      kinopoisk.searchMovies(query, page).catch(() => ({ results: [], totalResults: 0, totalPages: 0 })),
    ]);

    // Extract TMDB data and check availability
    const tmdbDataEn = tmdbEnResult.data;
    const tmdbDataRu = tmdbRuResult.data;
    const tmdbDataEnNorm = tmdbEnNormResult.data;
    const tmdbDataRuNorm = tmdbRuNormResult.data;

    const tmdbAvailable = !tmdbEnResult.timedOut && !tmdbRuResult.timedOut &&
      (tmdbDataEn.results.length > 0 || tmdbDataRu.results.length > 0);
    const kinopoiskAvailable = kinopoiskData.results.length > 0;
    const omdbAvailable = omdbData.results.length > 0;

    const sourceStatus: SourceStatus = {
      tmdb: tmdbAvailable,
      omdb: omdbAvailable,
      kinopoisk: kinopoiskAvailable,
    };

    // Create sets for deduplication
    const localTmdbIds = new Set(localResults.filter((m) => m.tmdbId).map((m) => m.tmdbId));
    const localKinopoiskIds = new Set(localResults.filter((m) => m.kinopoiskId).map((m) => m.kinopoiskId));

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
      imdbRating: m.imdbRating,
      kinopoiskRating: m.kinopoiskRating,
    }));

    // Merge results from all sources (EN + RU + normalized variants)
    // RU API often returns more results for Russian queries
    const seenTmdbIds = new Set<number>();

    // Collect all unique movies from EN results first
    const allTmdbEnResults = [...tmdbDataEn.results, ...tmdbDataEnNorm.results].filter((r) => {
      if (seenTmdbIds.has(r.id)) return false;
      seenTmdbIds.add(r.id);
      return true;
    });

    // Collect all unique movies from RU results (may have additional movies not in EN)
    const allTmdbRuResults = [...tmdbDataRu.results, ...tmdbDataRuNorm.results].filter((r) => {
      if (seenTmdbIds.has(r.id)) return false;
      seenTmdbIds.add(r.id);
      return true;
    });

    // Create map of RU data for all movies (from both EN and RU results)
    const ruDataMap = new Map(
      [...tmdbDataRu.results, ...tmdbDataRuNorm.results].map((r) => [r.id, { title: r.title, overview: r.overview }])
    );

    // Combine EN and RU results (RU may have movies that EN doesn't have for Russian queries)
    const allUniqueMovies = [...allTmdbEnResults, ...allTmdbRuResults];
    const newTmdbMovies = allUniqueMovies.filter((r) => !localTmdbIds.has(r.id));

    // Format new TMDB results with genreIds
    const tmdbSearchResults: SearchResult[] = newTmdbMovies.map((r) => {
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

    let allTmdbResults = [...localSearchResults, ...tmdbSearchResults];

    // Apply client-side filters
    if (genres.length > 0) {
      allTmdbResults = allTmdbResults.filter((movie) => {
        if (movie.genreIds) {
          return genres.some((gId) => movie.genreIds?.includes(gId));
        }
        return true; // Keep local cache results without genreIds
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

    const combinedTmdbResults = allTmdbResults.sort(sortFunctions[sortBy]);

    // Cache new movies in background using movieService
    if (newTmdbMovies.length > 0) {
      Promise.all(
        newTmdbMovies.slice(0, 10).map((movie) =>
          movieService.findOrCreate({ tmdbId: movie.id, source: 'tmdb' })
        )
      ).catch((err) => console.error('Failed to cache search results:', err));
    }

    // Format OMDB results
    const omdbResults: SearchResult[] = omdbData.results.map((r) => ({
      tmdbId: null,
      imdbId: r.imdbID,
      title: r.Title,
      titleRu: null,
      posterPath: r.Poster !== 'N/A' ? r.Poster : null,
      releaseDate: r.Year,
      voteAverage: null,
      overview: null,
      overviewRu: null,
      source: 'omdb' as const,
    }));

    // Format Kinopoisk results (exclude already found by local or imdbId match)
    const kinopoiskResults: SearchResult[] = kinopoiskData.results
      .filter((kp) => !localKinopoiskIds.has(kp.kinopoiskId))
      .map(kinopoiskToSearchResult);

    // Note: Kinopoisk API returns total count including TV series,
    // but we filter to only show movies. Estimate ~40% are movies.
    const estimatedKinopoiskMovies = Math.round(kinopoiskData.totalResults * 0.4);

    const totalPages = Math.ceil(tmdbDataEn.totalResults / 20);

    return NextResponse.json(
      {
        tmdb: {
          results: combinedTmdbResults,
          totalResults: tmdbDataEn.totalResults,
          page,
          totalPages,
        },
        omdb: { results: omdbResults, totalResults: omdbData.totalResults },
        kinopoisk: {
          results: kinopoiskResults,
          // Use estimated movie count instead of API's total (which includes TV series)
          totalResults: kinopoiskResults.length > 0 ? estimatedKinopoiskMovies : 0,
          totalPages: kinopoiskData.totalPages,
        },
        sourceStatus,
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
      omdb: { results: [], totalResults: 0 },
      kinopoisk: { results: [], totalResults: 0, totalPages: 0 },
      sourceStatus: { tmdb: false, omdb: false, kinopoisk: false },
    });
  }
}
