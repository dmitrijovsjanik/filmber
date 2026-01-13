import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { userSwipeHistory, movies } from '@/lib/db/schema';
import { getAuthUser, unauthorized, success } from '@/lib/auth/middleware';
import { eq, desc } from 'drizzle-orm';

// GET /api/history - Get user's swipe history
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'like' | 'skip' | null (all)
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build query
  const query = db
    .select({
      history: userSwipeHistory,
      movie: movies,
    })
    .from(userSwipeHistory)
    .leftJoin(movies, eq(userSwipeHistory.tmdbId, movies.tmdbId))
    .where(eq(userSwipeHistory.userId, user.id))
    .orderBy(desc(userSwipeHistory.createdAt))
    .limit(limit)
    .offset(offset);

  const items = await query;

  // Filter by action if specified
  let filteredItems = items;
  if (action === 'like' || action === 'skip') {
    filteredItems = items.filter((item) => item.history.action === action);
  }

  const result = filteredItems.map((item) => ({
    id: item.history.id,
    tmdbId: item.history.tmdbId,
    action: item.history.action,
    context: item.history.context,
    roomId: item.history.roomId,
    createdAt: item.history.createdAt.toISOString(),
    movie: item.movie
      ? {
          title: item.movie.title,
          titleRu: item.movie.titleRu,
          posterPath: item.movie.posterPath,
          posterUrl: item.movie.posterUrl,
          localPosterPath: item.movie.localPosterPath,
          releaseDate: item.movie.releaseDate,
          voteAverage: item.movie.tmdbRating,
        }
      : null,
  }));

  return success({
    items: result,
    total: result.length,
    limit,
    offset,
  });
}
