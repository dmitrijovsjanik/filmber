import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rooms, swipes } from '@/lib/db/schema';
import { sql, desc, count, eq } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;
  const status = searchParams.get('status'); // Optional filter

  // Build where clause
  const whereClause = status ? eq(rooms.status, status) : undefined;

  // Get rooms with stats
  const roomsData = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      status: rooms.status,
      userAConnected: rooms.userAConnected,
      userBConnected: rooms.userBConnected,
      userAId: rooms.userAId,
      userBId: rooms.userBId,
      matchedMovieId: rooms.matchedMovieId,
      createdAt: rooms.createdAt,
      expiresAt: rooms.expiresAt,
      swipeCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${swipes}
        WHERE ${swipes.roomId} = ${rooms.id}
      )::int`,
    })
    .from(rooms)
    .where(whereClause)
    .orderBy(desc(rooms.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(rooms)
    .where(whereClause);
  const total = totalResult?.count ?? 0;

  return success({
    data: roomsData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
