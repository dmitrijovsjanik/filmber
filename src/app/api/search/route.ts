import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';
import { omdb } from '@/lib/api/omdb';
import { db } from '@/lib/db';
import { movieCache } from '@/lib/db/schema';
import { or, ilike } from 'drizzle-orm';
import { enhanceMovieData } from '@/lib/api/moviePool';
import type { SearchResult } from '@/types/movie';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query || query.length < 2) {
    return NextResponse.json({
      tmdb: { results: [], totalResults: 0 },
      omdb: { results: [], totalResults: 0 },
    });
  }

  try {
    // Search in parallel: local database + TMDB + OMDB
    const [localResults, tmdbDataEn, tmdbDataRu, omdbData] = await Promise.all([
      // Local database search
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
      // TMDB search (English)
      tmdb.searchMovies(query, 'en-US').catch(() => ({ results: [], totalResults: 0 })),
      // TMDB search (Russian)
      tmdb.searchMovies(query, 'ru-RU').catch(() => ({ results: [], totalResults: 0 })),
      // OMDB search
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
    }));

    // Create a map of Russian titles/overviews by movie ID
    const ruDataMap = new Map(
      tmdbDataRu.results.map((r) => [r.id, { title: r.title, overview: r.overview }])
    );

    // Filter TMDB results to exclude movies already in local cache
    const newTmdbMovies = tmdbDataEn.results.filter((r) => !localTmdbIds.has(r.id));

    // Format new TMDB results
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
        overview: r.overview,
        overviewRu: ruData?.overview || null,
        source: 'tmdb' as const,
      };
    });

    // Combine local + new TMDB results (local first as they have more data)
    const combinedTmdbResults = [...localSearchResults, ...tmdbSearchResults];

    // Cache new TMDB movies in background (don't await)
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

    return NextResponse.json(
      {
        tmdb: {
          results: combinedTmdbResults,
          totalResults: localResults.length + tmdbDataEn.totalResults,
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
      tmdb: { results: [], totalResults: 0 },
      omdb: { results: [], totalResults: 0 },
    });
  }
}
