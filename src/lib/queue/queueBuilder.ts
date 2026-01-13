import { db } from '../db';
import {
  rooms,
  userMovieLists,
  deckSettings,
  swipes,
  movies,
  MOVIE_STATUS,
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateMoviePool, enhanceMovieData } from '../api/moviePool';
import { TMDBClient } from '../api/tmdb';
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
  // OPTIMIZED: Batch fetch all priority movies in a single query
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

    // Batch fetch all priority movies from DB
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

  // BASE POOL: Shuffled movie pool with bidirectional traversal
  const moviePool = await generateMoviePool(room.moviePoolSeed);

  // User A goes from start (index 0), User B goes from end
  const startIndex = userSlot === 'A' ? 0 : moviePool.length - 1;
  const step = userSlot === 'A' ? 1 : -1;

  let basePoolCount = 0;
  for (
    let i = startIndex;
    i >= 0 && i < moviePool.length;
    i += step
  ) {
    const movie = moviePool[i];
    if (!excludeIds.has(movie.tmdbId)) {
      queue.push({ movie, source: 'base' });
      excludeIds.add(movie.tmdbId);
      basePoolCount++;
    }
  }

  // Apply pagination
  const paginatedQueue = queue.slice(offset, offset + limit);
  const totalRemaining = queue.length - offset;

  return {
    movies: paginatedQueue,
    meta: {
      priorityQueueRemaining: Math.max(0, priorityCount - offset),
      basePoolRemaining: Math.max(0, basePoolCount - Math.max(0, offset - priorityCount)),
      totalRemaining,
      hasMore: totalRemaining > limit,
    },
  };
}

// OPTIMIZED: Batch fetch multiple movies by IDs
async function getMoviesByIds(tmdbIds: number[]): Promise<Map<number, Movie>> {
  const result = new Map<number, Movie>();
  if (tmdbIds.length === 0) return result;

  // Batch fetch from DB
  const cachedMovies = await db
    .select()
    .from(movies)
    .where(inArray(movies.tmdbId, tmdbIds));

  const foundIds = new Set<number>();
  for (const cached of cachedMovies) {
    if (!cached.tmdbId) continue;
    foundIds.add(cached.tmdbId);
    result.set(cached.tmdbId, {
      tmdbId: cached.tmdbId,
      title: cached.title,
      titleRu: cached.titleRu,
      overview: cached.overview || '',
      overviewRu: cached.overviewRu,
      posterUrl: TMDBClient.getSmartPosterUrl(
        cached.localPosterPath,
        cached.posterPath,
        cached.posterUrl
      ),
      releaseDate: cached.releaseDate || '',
      ratings: {
        tmdb: cached.tmdbRating || '0',
        imdb: cached.imdbRating,
        kinopoisk: cached.kinopoiskRating,
        rottenTomatoes: cached.rottenTomatoesRating,
        metacritic: cached.metacriticRating,
      },
      genres: JSON.parse(cached.genres || '[]'),
      runtime: cached.runtime,
      mediaType: (cached.mediaType as 'movie' | 'tv') || 'movie',
      numberOfSeasons: cached.numberOfSeasons,
      numberOfEpisodes: cached.numberOfEpisodes,
    });
  }

  // Fetch missing movies from external API (can't batch external calls)
  const missingIds = tmdbIds.filter((id) => !foundIds.has(id));
  for (const tmdbId of missingIds) {
    const movie = await enhanceMovieData(tmdbId);
    if (movie) {
      result.set(tmdbId, movie);
    }
  }

  return result;
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
