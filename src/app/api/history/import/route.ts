import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userSwipeHistory, userMovieLists, MOVIE_STATUS, MOVIE_SOURCE } from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, success } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

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

    let importedCount = 0;
    let addedToWatchlistCount = 0;

    // Import swipes one by one (upsert behavior)
    for (const swipe of swipes) {
      // Check if already exists
      const [existing] = await db
        .select()
        .from(userSwipeHistory)
        .where(
          and(eq(userSwipeHistory.userId, user.id), eq(userSwipeHistory.tmdbId, swipe.movieId))
        );

      if (!existing) {
        // Insert new swipe history
        await db.insert(userSwipeHistory).values({
          userId: user.id,
          tmdbId: swipe.movieId,
          action: swipe.action,
          context: 'solo',
          createdAt: new Date(swipe.timestamp),
        });
        importedCount++;

        // Add liked movies to watchlist if requested
        if (addLikesToWatchlist && swipe.action === 'like') {
          // Check if already in list
          const [existingInList] = await db
            .select()
            .from(userMovieLists)
            .where(
              and(eq(userMovieLists.userId, user.id), eq(userMovieLists.tmdbId, swipe.movieId))
            );

          if (!existingInList) {
            await db.insert(userMovieLists).values({
              userId: user.id,
              tmdbId: swipe.movieId,
              status: MOVIE_STATUS.WANT_TO_WATCH,
              source: MOVIE_SOURCE.IMPORT,
            });
            addedToWatchlistCount++;
          }
        }
      }
    }

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
