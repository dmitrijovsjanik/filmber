import { db } from '../db';
import {
  rooms,
  userMovieLists,
  deckSettings,
  swipes,
  MOVIE_STATUS,
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generatePaginatedMoviePool, getMoviesByIds } from '../api/moviePool';
import type { Movie } from '@/types/movie';

export interface QueueItem {
  movie: Movie;
  source: 'priority' | 'base' | 'partner_like';
}

export interface QueueBuildParams {
  roomCode: string;
  userSlot: 'A' | 'B';
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface QueueResponse {
  movies: QueueItem[];
  meta: {
    priorityQueueRemaining: number;
    basePoolRemaining: number;
    totalRemaining: number;
    hasMore: boolean;
  };
}

export async function buildQueue(params: QueueBuildParams): Promise<QueueResponse> {
  const { roomCode, userSlot, userId, limit = 20, offset = 0 } = params;

  // Get room info
  const [room] = await db.select().from(rooms).where(eq(rooms.code, roomCode));
  if (!room) {
    throw new Error('Room not found');
  }

  // Get partner ID
  const partnerId = userSlot === 'A' ? room.userBId : room.userAId;

  // Get user's deck settings (if authenticated)
  let userDeckSettings = null;
  if (userId) {
    const [settings] = await db
      .select()
      .from(deckSettings)
      .where(eq(deckSettings.userId, userId));
    userDeckSettings = settings;
  }

  // Build exclusion set (movies already swiped in this room + user's watched list)
  const excludeIds = new Set<number>();

  // Get already swiped movies in this room by this user
  const userSwipes = await db
    .select({ movieId: swipes.movieId })
    .from(swipes)
    .where(and(eq(swipes.roomId, room.id), eq(swipes.userSlot, userSlot)));

  userSwipes.forEach((s) => excludeIds.add(s.movieId));

  // Exclude user's watched movies (unless settings say otherwise)
  if (userId && (!userDeckSettings || !userDeckSettings.showWatchedMovies)) {
    const watched = await db
      .select({ tmdbId: userMovieLists.tmdbId })
      .from(userMovieLists)
      .where(
        and(
          eq(userMovieLists.userId, userId),
          eq(userMovieLists.status, MOVIE_STATUS.WATCHED)
        )
      );
    watched.forEach((w) => excludeIds.add(w.tmdbId));
  }

  const queue: QueueItem[] = [];

  // PRIORITY 1: Partner's likes (from swipes in this room)
  // PRIORITY 2: Partner's "want to watch" list
  if (partnerId) {
    // Get partner likes
    const partnerLikes = await db
      .select({ movieId: swipes.movieId })
      .from(swipes)
      .where(
        and(
          eq(swipes.roomId, room.id),
          eq(swipes.userSlot, userSlot === 'A' ? 'B' : 'A'),
          eq(swipes.action, 'like')
        )
      );

    // Get partner's want to watch list
    const partnerWantToWatch = await db
      .select({
        tmdbId: userMovieLists.tmdbId,
        rating: userMovieLists.rating,
      })
      .from(userMovieLists)
      .where(
        and(
          eq(userMovieLists.userId, partnerId),
          inArray(userMovieLists.status, [
            MOVIE_STATUS.WANT_TO_WATCH,
            MOVIE_STATUS.WATCHING,
          ])
        )
      );

    // Filter want-to-watch by rating if user has minRatingFilter set
    const filteredWantToWatch = userDeckSettings?.minRatingFilter
      ? partnerWantToWatch.filter(
          (m) => m.rating && m.rating >= userDeckSettings.minRatingFilter!
        )
      : partnerWantToWatch;

    // Collect all tmdbIds that need movie data (not already excluded)
    const likeIds = partnerLikes
      .filter((l) => !excludeIds.has(l.movieId))
      .map((l) => l.movieId);
    const wantToWatchIds = filteredWantToWatch
      .filter((w) => !excludeIds.has(w.tmdbId))
      .map((w) => w.tmdbId);
    const allPriorityIds = [...new Set([...likeIds, ...wantToWatchIds])];

    // Batch fetch all priority movies
    const priorityMoviesMap = await getMoviesByIds(allPriorityIds);

    // Add partner likes to queue (priority 1)
    for (const like of partnerLikes) {
      if (!excludeIds.has(like.movieId)) {
        const movie = priorityMoviesMap.get(like.movieId);
        if (movie) {
          queue.push({ movie, source: 'partner_like' });
          excludeIds.add(like.movieId);
        }
      }
    }

    // Add partner's want-to-watch to queue (priority 2)
    for (const item of filteredWantToWatch) {
      if (!excludeIds.has(item.tmdbId)) {
        const movie = priorityMoviesMap.get(item.tmdbId);
        if (movie) {
          queue.push({ movie, source: 'priority' });
          excludeIds.add(item.tmdbId);
        }
      }
    }
  }

  // Count priority items
  const priorityCount = queue.length;

  // Calculate how many base pool items we need
  const priorityInThisPage = Math.min(priorityCount, Math.max(0, priorityCount - offset));
  const baseNeeded = limit - priorityInThisPage;
  const baseOffset = Math.max(0, offset - priorityCount);

  // BASE POOL: Paginated movie pool - only fetch what we need!
  // Request extra items to account for exclusions
  const bufferMultiplier = 2;
  const { movies: basePoolMovies, totalCount, hasMore: poolHasMore } = await generatePaginatedMoviePool(
    room.moviePoolSeed,
    0, // Always start from 0, we'll filter and track progress
    Math.max(baseNeeded * bufferMultiplier, 50), // Fetch enough to cover exclusions
    'all' // TODO: use userDeckSettings?.mediaTypeFilter
  );

  // User A goes from start (index 0), User B goes from end
  const orderedPool = userSlot === 'A' ? basePoolMovies : [...basePoolMovies].reverse();

  let basePoolCount = 0;
  let skipped = 0;
  for (const movie of orderedPool) {
    if (!excludeIds.has(movie.tmdbId)) {
      // Skip items before our offset
      if (skipped < baseOffset) {
        skipped++;
        continue;
      }
      queue.push({ movie, source: 'base' });
      excludeIds.add(movie.tmdbId);
      basePoolCount++;

      // Stop when we have enough
      if (basePoolCount >= baseNeeded) {
        break;
      }
    }
  }

  // Apply pagination to the final queue
  const paginatedQueue = queue.slice(offset, offset + limit);
  const totalRemaining = priorityCount + totalCount - offset;

  return {
    movies: paginatedQueue,
    meta: {
      priorityQueueRemaining: Math.max(0, priorityCount - offset),
      basePoolRemaining: Math.max(0, totalCount - baseOffset - basePoolCount),
      totalRemaining: Math.max(0, totalRemaining),
      hasMore: poolHasMore || basePoolCount >= baseNeeded,
    },
  };
}

// Inject a partner-liked movie into the queue (for real-time updates)
export function injectPartnerLike(
  queue: QueueItem[],
  movie: Movie,
  currentIndex: number
): QueueItem[] {
  const newQueue = [...queue];
  // Insert right after the current position
  newQueue.splice(currentIndex + 1, 0, { movie, source: 'partner_like' });
  return newQueue;
}
