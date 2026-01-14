import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { desc, count, like, or } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;
  const search = searchParams.get('search');

  // Build where clause for search
  const whereClause = search
    ? or(
        like(movies.title, `%${search}%`),
        like(movies.titleRu, `%${search}%`)
      )
    : undefined;

  // Get movies
  const moviesData = await db
    .select({
      id: movies.id,
      tmdbId: movies.tmdbId,
      imdbId: movies.imdbId,
      kinopoiskId: movies.kinopoiskId,
      title: movies.title,
      titleRu: movies.titleRu,
      releaseDate: movies.releaseDate,
      mediaType: movies.mediaType,
      tmdbRating: movies.tmdbRating,
      imdbRating: movies.imdbRating,
      kinopoiskRating: movies.kinopoiskRating,
      primarySource: movies.primarySource,
      cachedAt: movies.cachedAt,
    })
    .from(movies)
    .where(whereClause)
    .orderBy(desc(movies.cachedAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(movies)
    .where(whereClause);
  const total = totalResult?.count ?? 0;

  return success({
    data: moviesData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
