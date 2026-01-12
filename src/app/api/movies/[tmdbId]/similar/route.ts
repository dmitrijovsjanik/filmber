import { NextRequest, NextResponse } from 'next/server';
import { tastedive } from '@/lib/api/tastedive';
import { tmdb } from '@/lib/api/tmdb';
import { movieService } from '@/lib/services/movieService';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// In-memory cache for similar movies results
const similarCache = new Map<
  number,
  { movies: SimilarMovie[]; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface SimilarMovie {
  tmdbId: number;
  imdbId: string | null;
  kinopoiskId: number | null;
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  overview: string | null;
  overviewRu: string | null;
  runtime: number | null;
  genres: string | null;
  imdbRating: string | null;
  kinopoiskRating: string | null;
}

// Match TasteDive movie name to TMDB ID
async function matchToTMDB(title: string): Promise<number | null> {
  try {
    const { results } = await tmdb.searchMovies(title, 'en-US');

    if (results.length === 0) {
      return null;
    }

    // Find best match - prefer exact title match with highest vote_count
    const normalizedQuery = title.toLowerCase().trim();

    const scored = results.map((movie) => {
      let score = 0;

      // Exact title match
      if (movie.title.toLowerCase() === normalizedQuery) {
        score += 100;
      }
      // Starts with query
      else if (movie.title.toLowerCase().startsWith(normalizedQuery)) {
        score += 50;
      }

      // Popularity/vote count bonus
      score += Math.min(movie.vote_count / 100, 50);

      // Higher rating bonus
      score += movie.vote_average * 2;

      return { movie, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.movie.id || null;
  } catch (error) {
    console.error(`Failed to match "${title}" to TMDB:`, error);
    return null;
  }
}

// Get similar movies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId: tmdbIdStr } = await params;
    const tmdbId = parseInt(tmdbIdStr, 10);

    if (!tmdbId || isNaN(tmdbId)) {
      return NextResponse.json(
        { error: 'Invalid tmdbId parameter' },
        { status: 400 }
      );
    }

    // Check in-memory cache
    const cached = similarCache.get(tmdbId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(
        { movies: cached.movies },
        {
          headers: {
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        }
      );
    }

    // Get movie title from database or TMDB
    let movieTitle: string | null = null;

    const [dbMovie] = await db
      .select({ title: movies.title })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);

    if (dbMovie?.title) {
      movieTitle = dbMovie.title;
    } else {
      // Fetch from TMDB
      const tmdbMovie = await tmdb.getMovieDetails(tmdbId, 'en-US');
      movieTitle = tmdbMovie?.title || null;
    }

    if (!movieTitle) {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      );
    }

    // Get similar movies from TasteDive
    const tasteDiveResults = await tastedive.getSimilarMovies(movieTitle, 10);

    if (tasteDiveResults.length === 0) {
      similarCache.set(tmdbId, { movies: [], timestamp: Date.now() });
      return NextResponse.json({ movies: [] });
    }

    // Match each result to TMDB and get movie data
    const similarMovies: SimilarMovie[] = [];

    await Promise.all(
      tasteDiveResults.map(async (result) => {
        const matchedTmdbId = await matchToTMDB(result.Name);

        if (!matchedTmdbId || matchedTmdbId === tmdbId) {
          return; // Skip if not found or same as source movie
        }

        // Get or create movie in our database
        const movie = await movieService.findOrCreate({ tmdbId: matchedTmdbId });

        if (movie && movie.tmdbId) {
          similarMovies.push({
            tmdbId: movie.tmdbId,
            imdbId: movie.imdbId,
            kinopoiskId: movie.kinopoiskId,
            title: movie.title,
            titleRu: movie.titleRu,
            posterPath: movie.posterPath,
            posterUrl: movie.posterUrl,
            releaseDate: movie.releaseDate,
            voteAverage: movie.tmdbRating,
            overview: movie.overview,
            overviewRu: movie.overviewRu,
            runtime: movie.runtime,
            genres: movie.genres,
            imdbRating: movie.imdbRating,
            kinopoiskRating: movie.kinopoiskRating,
          });
        }
      })
    );

    // Limit to 8 results
    const limitedResults = similarMovies.slice(0, 8);

    // Cache results
    similarCache.set(tmdbId, {
      movies: limitedResults,
      timestamp: Date.now(),
    });

    return NextResponse.json(
      { movies: limitedResults },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get similar movies:', error);
    return NextResponse.json(
      { error: 'Failed to get similar movies' },
      { status: 500 }
    );
  }
}
