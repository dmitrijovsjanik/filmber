import { db } from '../db';
import {
  rooms,
  userMovieLists,
  deckSettings,
  swipes,
  movieCache,
  MOVIE_STATUS,
} from '../db/schema';
import { eq, and, inArray, gte } from 'drizzle-orm';
import { generateMoviePool, enhanceMovieData } from '../api/moviePool';
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
  if (partnerId) {
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

    for (const like of partnerLikes) {
      if (!excludeIds.has(like.movieId)) {
        const movie = await getMovieById(like.movieId);
        if (movie) {
          queue.push({ movie, source: 'partner_like' });
          excludeIds.add(like.movieId);
        }
      }
    }
  }

  // PRIORITY 2: Partner's "want to watch" list
  if (partnerId) {
    let partnerWantToWatchQuery = db
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

    const partnerWantToWatch = await partnerWantToWatchQuery;

    // Filter by rating if user has minRatingFilter set
    const filteredWantToWatch = userDeckSettings?.minRatingFilter
      ? partnerWantToWatch.filter(
          (m) => m.rating && m.rating >= userDeckSettings.minRatingFilter!
        )
      : partnerWantToWatch;

    for (const item of filteredWantToWatch) {
      if (!excludeIds.has(item.tmdbId)) {
        const movie = await getMovieById(item.tmdbId);
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

async function getMovieById(tmdbId: number): Promise<Movie | null> {
  // Check cache first
  const [cached] = await db
    .select()
    .from(movieCache)
    .where(eq(movieCache.tmdbId, tmdbId));

  if (cached) {
    return {
      tmdbId: cached.tmdbId,
      title: cached.title,
      titleRu: cached.titleRu,
      overview: cached.overview || '',
      overviewRu: cached.overviewRu,
      posterUrl: cached.posterPath
        ? `https://image.tmdb.org/t/p/w500${cached.posterPath}`
        : '',
      releaseDate: cached.releaseDate || '',
      ratings: {
        tmdb: cached.voteAverage || '0',
        imdb: cached.imdbRating,
        kinopoisk: null,
        rottenTomatoes: cached.rottenTomatoesRating,
        metacritic: cached.metacriticRating,
      },
      genres: JSON.parse(cached.genres || '[]'),
      runtime: cached.runtime,
      mediaType: 'movie',
      numberOfSeasons: null,
      numberOfEpisodes: null,
    };
  }

  // Fetch and cache if not found
  return enhanceMovieData(tmdbId);
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
