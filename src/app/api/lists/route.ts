import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  userMovieLists,
  movies,
  MOVIE_STATUS,
  MOVIE_SOURCE,
  type MovieStatus,
  type MovieSource,
} from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, success } from '@/lib/auth/middleware';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { movieService } from '@/lib/services/movieService';

interface MovieListItem {
  id: string;
  tmdbId: number;
  status: MovieStatus;
  rating: number | null;
  source: MovieSource;
  notes: string | null;
  watchedAt: string | null;
  watchStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movie: {
    title: string;
    titleRu: string | null;
    posterPath: string | null;
    posterUrl: string | null;
    localPosterPath: string | null;
    releaseDate: string | null;
    voteAverage: string | null;
    genres: string | null;
    runtime: number | null;
    overview: string | null;
    overviewRu: string | null;
    imdbRating: string | null;
    kinopoiskRating: string | null;
    rottenTomatoesRating: string | null;
    mediaType: string;
    numberOfSeasons: number | null;
    numberOfEpisodes: number | null;
    originalLanguage: string | null;
  } | null;
}

// GET /api/lists - Get user's movie lists
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as MovieStatus | null;
  const rating = searchParams.get('rating');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build query conditions
  const conditions = [eq(userMovieLists.userId, user.id)];

  if (status && Object.values(MOVIE_STATUS).includes(status)) {
    // 'watching' movies should appear in both want_to_watch and watched lists
    if (status === MOVIE_STATUS.WANT_TO_WATCH || status === MOVIE_STATUS.WATCHED) {
      conditions.push(
        inArray(userMovieLists.status, [status, MOVIE_STATUS.WATCHING])
      );
    } else {
      conditions.push(eq(userMovieLists.status, status));
    }
  }

  if (rating) {
    const ratingNum = parseInt(rating, 10);
    if (ratingNum >= 1 && ratingNum <= 3) {
      conditions.push(eq(userMovieLists.rating, ratingNum));
    }
  }

  // Get list items with movie data (using unifiedMovieId for JOIN)
  const items = await db
    .select({
      list: userMovieLists,
      movie: movies,
    })
    .from(userMovieLists)
    .leftJoin(movies, eq(userMovieLists.unifiedMovieId, movies.id))
    .where(and(...conditions))
    .orderBy(desc(userMovieLists.updatedAt))
    .limit(limit)
    .offset(offset);

  // Filter by search if provided (search in cached movie titles)
  let filteredItems = items;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredItems = items.filter((item) => {
      if (!item.movie) return false;
      return (
        item.movie.title.toLowerCase().includes(searchLower) ||
        (item.movie.titleRu && item.movie.titleRu.toLowerCase().includes(searchLower))
      );
    });
  }

  const result: MovieListItem[] = filteredItems.map((item) => ({
    id: item.list.id,
    tmdbId: item.list.tmdbId,
    status: item.list.status as MovieStatus,
    rating: item.list.rating,
    source: item.list.source as MovieSource,
    notes: item.list.notes,
    watchedAt: item.list.watchedAt?.toISOString() || null,
    watchStartedAt: item.list.watchStartedAt?.toISOString() || null,
    createdAt: item.list.createdAt.toISOString(),
    updatedAt: item.list.updatedAt.toISOString(),
    movie: item.movie
      ? {
          title: item.movie.title,
          titleRu: item.movie.titleRu,
          posterPath: item.movie.posterPath,
          posterUrl: item.movie.posterUrl,
          localPosterPath: item.movie.localPosterPath,
          releaseDate: item.movie.releaseDate,
          voteAverage: item.movie.tmdbRating,
          genres: item.movie.genres,
          runtime: item.movie.runtime,
          overview: item.movie.overview,
          overviewRu: item.movie.overviewRu,
          imdbRating: item.movie.imdbRating,
          kinopoiskRating: item.movie.kinopoiskRating,
          rottenTomatoesRating: item.movie.rottenTomatoesRating,
          mediaType: item.movie.mediaType,
          numberOfSeasons: item.movie.numberOfSeasons,
          numberOfEpisodes: item.movie.numberOfEpisodes,
          originalLanguage: item.movie.originalLanguage,
        }
      : null,
  }));

  // Get counts for filters
  const countsResult = await db
    .select({
      status: userMovieLists.status,
      rating: userMovieLists.rating,
      count: count(),
    })
    .from(userMovieLists)
    .where(eq(userMovieLists.userId, user.id))
    .groupBy(userMovieLists.status, userMovieLists.rating);

  const counts = {
    all: 0,
    watching: 0,
    wantToWatch: 0,
    watched: 0,
    ratings: { 1: 0, 2: 0, 3: 0 } as Record<number, number>,
  };

  for (const row of countsResult) {
    counts.all += row.count;
    if (row.status === MOVIE_STATUS.WATCHING) {
      // 'watching' counts towards BOTH lists
      counts.watching += row.count;
      counts.wantToWatch += row.count;
      counts.watched += row.count;
    } else if (row.status === MOVIE_STATUS.WANT_TO_WATCH) {
      counts.wantToWatch += row.count;
    } else if (row.status === MOVIE_STATUS.WATCHED) {
      counts.watched += row.count;
      if (row.rating && row.rating >= 1 && row.rating <= 3) {
        counts.ratings[row.rating] = (counts.ratings[row.rating] || 0) + row.count;
      }
    }
  }

  return success({
    items: result,
    total: result.length,
    limit,
    offset,
    counts,
  });
}

// POST /api/lists - Add movie to list
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { tmdbId, status, rating, source, notes, mediaType } = body;

    // Validate required fields
    if (!tmdbId || typeof tmdbId !== 'number') {
      return badRequest('tmdbId is required and must be a number');
    }

    if (!status || !Object.values(MOVIE_STATUS).includes(status)) {
      return badRequest('status must be "watching", "want_to_watch" or "watched"');
    }

    const movieSource = source || MOVIE_SOURCE.MANUAL;
    if (!Object.values(MOVIE_SOURCE).includes(movieSource)) {
      return badRequest('source must be "swipe", "manual", or "import"');
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 3) {
        return badRequest('rating must be 1, 2, or 3');
      }
    }

    // Ensure movie exists in database and get its unified ID
    let movie = await movieService.findByExternalId({ tmdbId });

    if (!movie) {
      // Fetch and cache movie data
      movie = await movieService.findOrCreate({ tmdbId, source: 'tmdb', mediaType });
    }

    if (!movie) {
      return badRequest('Failed to fetch movie data');
    }

    // Check if movie already exists in user's list (by unifiedMovieId)
    const [existing] = await db
      .select()
      .from(userMovieLists)
      .where(and(eq(userMovieLists.userId, user.id), eq(userMovieLists.unifiedMovieId, movie.id)));

    if (existing) {
      // Determine if we should start the watch timer
      // Start timer when: source is swipe, status is watching, and timer not already started
      const shouldStartTimer =
        movieSource === MOVIE_SOURCE.SWIPE &&
        status === MOVIE_STATUS.WATCHING &&
        !existing.watchStartedAt;

      // Update existing entry
      const [updated] = await db
        .update(userMovieLists)
        .set({
          status,
          rating: rating || existing.rating,
          notes: notes !== undefined ? notes : existing.notes,
          watchedAt: status === MOVIE_STATUS.WATCHED ? new Date() : existing.watchedAt,
          watchStartedAt: shouldStartTimer ? new Date() : existing.watchStartedAt,
          updatedAt: new Date(),
        })
        .where(eq(userMovieLists.id, existing.id))
        .returning();

      return success(updated);
    }

    // Create new entry
    // If added via swipe with 'watching' status, start the timer
    const shouldStartTimer = movieSource === MOVIE_SOURCE.SWIPE && status === MOVIE_STATUS.WATCHING;

    const [created] = await db
      .insert(userMovieLists)
      .values({
        userId: user.id,
        tmdbId,
        unifiedMovieId: movie.id,
        status,
        rating: rating || null,
        source: movieSource,
        notes: notes || null,
        watchedAt: status === MOVIE_STATUS.WATCHED ? new Date() : null,
        watchStartedAt: shouldStartTimer ? new Date() : null,
      })
      .returning();

    return success(created, 201);
  } catch (error) {
    console.error('Error adding to list:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
