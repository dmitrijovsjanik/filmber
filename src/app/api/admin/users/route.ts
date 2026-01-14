import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, userMovieLists } from '@/lib/db/schema';
import { sql, desc, count, eq } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;

  // Get users with movie count
  const usersWithStats = await db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      telegramUsername: users.telegramUsername,
      firstName: users.firstName,
      lastName: users.lastName,
      isPremium: users.isPremium,
      lastSeenAt: users.lastSeenAt,
      createdAt: users.createdAt,
      movieCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${userMovieLists}
        WHERE ${userMovieLists.userId} = ${users.id}
      )::int`,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [totalResult] = await db.select({ count: count() }).from(users);
  const total = totalResult?.count ?? 0;

  return success({
    data: usersWithStats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
