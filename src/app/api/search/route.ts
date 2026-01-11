import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';
import { omdb } from '@/lib/api/omdb';
import { db } from '@/lib/db';
import { movieCache } from '@/lib/db/schema';
import { or, ilike } from 'drizzle-orm';
import { enhanceMovieData } from '@/lib/api/moviePool';
import type { SearchResult, SortOption } from '@/types/movie';

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
      });
    }

    // Normalize ё -> е for Russian search queries
    const normalizedQuery = query.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
    const hasYoChar = query !== normalizedQuery;

    // Search in parallel: local database + TMDB + OMDB
    const [localResults, tmdbDataEn, tmdbDataRu, tmdbDataEnNorm, tmdbDataRuNorm, omdbData] = await Promise.all([
      db
        .select()
        .from(movieCache)
        .where(
          or(
            ilike(movieCache.title, `%${query}%`),
            ilike(movieCache.titleRu, `%${query}%`)
          )
        )
        .limit(20)
        .catch(() => []),
      tmdb.searchMovies(query, 'en-US', page).catch(() => ({ results: [], totalResults: 0 })),
      tmdb.searchMovies(query, 'ru-RU', page).catch(() => ({ results: [], totalResults: 0 })),
      hasYoChar
        ? tmdb.searchMovies(normalizedQuery, 'en-US', page).catch(() => ({ results: [], totalResults: 0 }))
        : Promise.resolve({ results: [], totalResults: 0 }),
      hasYoChar
        ? tmdb.searchMovies(normalizedQuery, 'ru-RU', page).catch(() => ({ results: [], totalResults: 0 }))
        : Promise.resolve({ results: [], totalResults: 0 }),
      omdb.searchMovies(query).catch(() => ({ results: [], totalResults: 0 })),
    ]);

    // Create a set of local tmdbIds for deduplication
    const localTmdbIds = new Set(localResults.map((m) => m.tmdbId));

    // Format local results as SearchResult
    const localSearchResults: SearchResult[] = localResults.map((m) => ({
      tmdbId: m.tmdbId,
      imdbId: m.imdbId,
      title: m.title,
      titleRu: m.titleRu,
      posterPath: m.posterPath,
      releaseDate: m.releaseDate,
      voteAverage: m.voteAverage,
      overview: m.overview,
      overviewRu: m.overviewRu,
      source: 'tmdb' as const,
      runtime: m.runtime,
      genres: m.genres,
      genreIds: null, // Local cache doesn't have genre_ids
      imdbRating: m.imdbRating,
    }));

    // Merge normalized search results with main results
    const seenTmdbIds = new Set<number>();
    const allTmdbEnResults = [...tmdbDataEn.results, ...tmdbDataEnNorm.results].filter((r) => {
      if (seenTmdbIds.has(r.id)) return false;
      seenTmdbIds.add(r.id);
      return true;
    });

    const allTmdbRuResults = [...tmdbDataRu.results, ...tmdbDataRuNorm.results].filter((r) => {
      if (seenTmdbIds.has(r.id)) return true;
      seenTmdbIds.add(r.id);
      return true;
    });

    const ruDataMap = new Map(
      allTmdbRuResults.map((r) => [r.id, { title: r.title, overview: r.overview }])
    );

    const newTmdbMovies = allTmdbEnResults.filter((r) => !localTmdbIds.has(r.id));

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

      // 1. Exact match
      const exactMatchA = titleA === queryNorm || titleEnA === queryNorm;
      const exactMatchB = titleB === queryNorm || titleEnB === queryNorm;
      if (exactMatchA && !exactMatchB) return -1;
      if (exactMatchB && !exactMatchA) return 1;

      // 2. Starts with
      const startsWithA = titleA.startsWith(queryNorm) || titleEnA.startsWith(queryNorm);
      const startsWithB = titleB.startsWith(queryNorm) || titleEnB.startsWith(queryNorm);
      if (startsWithA && !startsWithB) return -1;
      if (startsWithB && !startsWithA) return 1;

      // 3. Vote count
      const voteCountA = a.voteCount || 0;
      const voteCountB = b.voteCount || 0;
      if (voteCountA !== voteCountB) return voteCountB - voteCountA;

      // 4. Popularity
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      if (popA !== popB) return popB - popA;

      // 5. Episode number
      const episodeA = extractEpisodeNumber(a.titleRu || a.title || '');
      const episodeB = extractEpisodeNumber(b.titleRu || b.title || '');
      if (episodeA !== null && episodeB !== null) return episodeA - episodeB;
      if (episodeA !== null && episodeB === null) return -1;
      if (episodeB !== null && episodeA === null) return 1;

      // 6. Release date
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

    // Cache new movies in background
    if (newTmdbMovies.length > 0) {
      Promise.all(
        newTmdbMovies.slice(0, 10).map((movie) => enhanceMovieData(movie.id))
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
    });
  }
}
