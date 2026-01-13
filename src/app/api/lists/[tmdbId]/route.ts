import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userMovieLists, movies, MOVIE_STATUS } from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, notFound, success } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ tmdbId: string }>;
}

// GET /api/lists/[tmdbId] - Get specific movie from user's list
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { tmdbId: tmdbIdStr } = await params;
  const tmdbId = parseInt(tmdbIdStr, 10);

  if (isNaN(tmdbId)) {
    return badRequest('Invalid tmdbId');
  }

  // Look up movie by tmdbId to get unifiedMovieId
  const [movie] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId));

  if (!movie) {
    return notFound('Movie not found');
  }

  const [item] = await db
    .select()
    .from(userMovieLists)
    .where(and(eq(userMovieLists.userId, user.id), eq(userMovieLists.unifiedMovieId, movie.id)));

  if (!item) {
    return notFound('Movie not in list');
  }

  return success(item);
}

// PATCH /api/lists/[tmdbId] - Update movie in user's list
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { tmdbId: tmdbIdStr } = await params;
  const tmdbId = parseInt(tmdbIdStr, 10);

  if (isNaN(tmdbId)) {
    return badRequest('Invalid tmdbId');
  }

  try {
    const body = await request.json();
    const { status, rating, notes, watchStartedAt } = body;

    // Validate status if provided
    if (status && !Object.values(MOVIE_STATUS).includes(status)) {
      return badRequest('status must be "want_to_watch" or "watched"');
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 3) {
        return badRequest('rating must be 1, 2, or 3');
      }
    }

    // Look up movie by tmdbId to get unifiedMovieId
    const [movie] = await db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId));

    if (!movie) {
      return notFound('Movie not found');
    }

    // Find existing entry
    const [existing] = await db
      .select()
      .from(userMovieLists)
      .where(and(eq(userMovieLists.userId, user.id), eq(userMovieLists.unifiedMovieId, movie.id)));

    if (!existing) {
      return notFound('Movie not in list');
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updates.status = status;
      // Set watchedAt when status changes to watched
      if (status === MOVIE_STATUS.WATCHED && existing.status !== MOVIE_STATUS.WATCHED) {
        updates.watchedAt = new Date();
        // Clear watchStartedAt when marked as watched
        updates.watchStartedAt = null;
      }
    }

    if (rating !== undefined) {
      updates.rating = rating;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    // Allow clearing watchStartedAt (e.g., when user clicks "not yet")
    if (watchStartedAt === null) {
      updates.watchStartedAt = null;
    }

    const [updated] = await db
      .update(userMovieLists)
      .set(updates)
      .where(eq(userMovieLists.id, existing.id))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('Error updating list item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/lists/[tmdbId] - Remove movie from user's list
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { tmdbId: tmdbIdStr } = await params;
  const tmdbId = parseInt(tmdbIdStr, 10);

  if (isNaN(tmdbId)) {
    return badRequest('Invalid tmdbId');
  }

  // Look up movie by tmdbId to get unifiedMovieId
  const [movie] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId));

  if (!movie) {
    return notFound('Movie not found');
  }

  // First check if the item exists
  const [existing] = await db
    .select({ id: userMovieLists.id })
    .from(userMovieLists)
    .where(and(eq(userMovieLists.userId, user.id), eq(userMovieLists.unifiedMovieId, movie.id)));

  if (!existing) {
    return notFound('Movie not in list');
  }

  await db
    .delete(userMovieLists)
    .where(eq(userMovieLists.id, existing.id));

  return success({ success: true });
}
