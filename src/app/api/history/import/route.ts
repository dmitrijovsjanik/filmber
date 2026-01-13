import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userSwipeHistory, userMovieLists, movies, MOVIE_STATUS, MOVIE_SOURCE } from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, success } from '@/lib/auth/middleware';
import { eq, inArray } from 'drizzle-orm';
import { movieService } from '@/lib/services/movieService';

interface AnonymousSwipe {
  movieId: number;
  action: 'like' | 'skip';
  timestamp: number;
}

interface ImportRequest {
  swipes: AnonymousSwipe[];
  addLikesToWatchlist?: boolean;
}

// POST /api/history/import - Import anonymous swipes
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const body: ImportRequest = await request.json();
    const { swipes, addLikesToWatchlist = true } = body;

    if (!Array.isArray(swipes)) {
      return badRequest('swipes must be an array');
    }

    if (swipes.length === 0) {
      return success({ imported: 0, addedToWatchlist: 0 });
    }

    // Validate swipes
    for (const swipe of swipes) {
      if (typeof swipe.movieId !== 'number') {
        return badRequest('Each swipe must have a numeric movieId');
      }
      if (swipe.action !== 'like' && swipe.action !== 'skip') {
        return badRequest('Each swipe action must be "like" or "skip"');
      }
    }

    // OPTIMIZED: Batch queries instead of N+1 pattern
    const tmdbIds = swipes.map((s) => s.movieId);

    // 1. Batch fetch existing movies from DB
    const existingMovies = await db
      .select({ id: movies.id, tmdbId: movies.tmdbId })
      .from(movies)
      .where(inArray(movies.tmdbId, tmdbIds));
    const movieMap = new Map(existingMovies.map((m) => [m.tmdbId!, m.id]));

    // 2. Find movies not in DB and fetch them (unavoidable external API calls)
    const missingTmdbIds = tmdbIds.filter((id) => !movieMap.has(id));
    for (const tmdbId of missingTmdbIds) {
      const movie = await movieService.findOrCreate({ tmdbId, source: 'tmdb' });
      if (movie) {
        movieMap.set(tmdbId, movie.id);
      }
    }

    // 3. Batch fetch existing swipe history for this user
    const existingSwipes = await db
      .select({ unifiedMovieId: userSwipeHistory.unifiedMovieId })
      .from(userSwipeHistory)
      .where(eq(userSwipeHistory.userId, user.id));
    const existingSwipeSet = new Set(existingSwipes.map((s) => s.unifiedMovieId));

    // 4. Batch fetch existing watchlist items for likes
    const existingWatchlist = await db
      .select({ unifiedMovieId: userMovieLists.unifiedMovieId })
      .from(userMovieLists)
      .where(eq(userMovieLists.userId, user.id));
    const existingWatchlistSet = new Set(existingWatchlist.map((w) => w.unifiedMovieId));

    // 5. Prepare batch inserts
    const swipesToInsert: (typeof userSwipeHistory.$inferInsert)[] = [];
    const watchlistToInsert: (typeof userMovieLists.$inferInsert)[] = [];

    for (const swipe of swipes) {
      const unifiedMovieId = movieMap.get(swipe.movieId);
      if (!unifiedMovieId) continue;

      // Add to swipe history if not exists
      if (!existingSwipeSet.has(unifiedMovieId)) {
        swipesToInsert.push({
          userId: user.id,
          tmdbId: swipe.movieId,
          unifiedMovieId,
          action: swipe.action,
          context: 'solo',
          createdAt: new Date(swipe.timestamp),
        });
        existingSwipeSet.add(unifiedMovieId); // Prevent duplicates in batch
      }

      // Add to watchlist if like and not exists
      if (addLikesToWatchlist && swipe.action === 'like' && !existingWatchlistSet.has(unifiedMovieId)) {
        watchlistToInsert.push({
          userId: user.id,
          tmdbId: swipe.movieId,
          unifiedMovieId,
          status: MOVIE_STATUS.WANT_TO_WATCH,
          source: MOVIE_SOURCE.IMPORT,
        });
        existingWatchlistSet.add(unifiedMovieId); // Prevent duplicates in batch
      }
    }

    // 6. Batch insert swipe history
    if (swipesToInsert.length > 0) {
      await db.insert(userSwipeHistory).values(swipesToInsert);
    }

    // 7. Batch insert watchlist items
    if (watchlistToInsert.length > 0) {
      await db.insert(userMovieLists).values(watchlistToInsert);
    }

    const importedCount = swipesToInsert.length;
    const addedToWatchlistCount = watchlistToInsert.length;

    return success({
      imported: importedCount,
      addedToWatchlist: addedToWatchlistCount,
      total: swipes.length,
    });
  } catch (error) {
    console.error('Error importing history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
