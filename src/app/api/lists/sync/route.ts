import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  userMovieLists,
  MOVIE_STATUS,
  MOVIE_SOURCE,
} from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, success } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';
import { movieService } from '@/lib/services/movieService';

interface SyncItem {
  tmdbId: number;
  mediaType?: 'movie' | 'tv';
  status?: 'want_to_watch' | 'watching' | 'watched';
}

interface SyncResult {
  added: number;
  skipped: number;
  errors: number;
}

// POST /api/lists/sync - Batch sync local likes after authentication
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { items } = body as { items: SyncItem[] };

    if (!items || !Array.isArray(items)) {
      return badRequest('items array is required');
    }

    if (items.length === 0) {
      return success({ added: 0, skipped: 0, errors: 0 });
    }

    if (items.length > 100) {
      return badRequest('Maximum 100 items per sync request');
    }

    const result: SyncResult = {
      added: 0,
      skipped: 0,
      errors: 0,
    };

    // Process each item
    for (const item of items) {
      try {
        if (!item.tmdbId || typeof item.tmdbId !== 'number') {
          result.errors++;
          continue;
        }

        // Check if movie already exists in user's list
        let movie = await movieService.findByExternalId({ tmdbId: item.tmdbId });

        if (!movie) {
          // Fetch and cache movie data
          movie = await movieService.findOrCreate({
            tmdbId: item.tmdbId,
            source: 'tmdb',
            mediaType: item.mediaType,
          });
        }

        if (!movie) {
          result.errors++;
          continue;
        }

        // Check for existing entry
        const [existing] = await db
          .select()
          .from(userMovieLists)
          .where(
            and(
              eq(userMovieLists.userId, user.id),
              eq(userMovieLists.unifiedMovieId, movie.id)
            )
          );

        if (existing) {
          // Movie already in list - skip (don't overwrite user's existing data)
          result.skipped++;
          continue;
        }

        // Add new entry with default status
        const status = item.status || MOVIE_STATUS.WANT_TO_WATCH;

        await db.insert(userMovieLists).values({
          userId: user.id,
          tmdbId: item.tmdbId,
          unifiedMovieId: movie.id,
          status,
          source: MOVIE_SOURCE.SWIPE,
          rating: null,
          notes: null,
          watchedAt: null,
          watchStartedAt: null,
        });

        result.added++;
      } catch (itemError) {
        console.error('Error syncing item:', item.tmdbId, itemError);
        result.errors++;
      }
    }

    return success(result);
  } catch (error) {
    console.error('Error in sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
