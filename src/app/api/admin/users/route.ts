import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users, userMovieLists, rooms, userSessions } from '@/lib/db/schema';
import { sql, desc, count, asc } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;
  const sortBy = searchParams.get('sortBy') || 'lastSeenAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Time boundaries for activity stats (as ISO strings for raw SQL)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Build order by clause
  const orderByColumn = (() => {
    switch (sortBy) {
      case 'movieCount':
        return sql`movie_count`;
      case 'roomsTotal':
        return sql`rooms_total`;
      case 'activityWeek':
        return sql`activity_week`;
      case 'lastSeenAt':
        return users.lastSeenAt;
      case 'createdAt':
      default:
        return users.createdAt;
    }
  })();

  // Get users with comprehensive stats
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
      // Movie list count
      movieCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${userMovieLists}
        WHERE ${userMovieLists.userId} = ${users.id}
      )::int`.as('movie_count'),
      // Watching count
      watchingCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${userMovieLists}
        WHERE ${userMovieLists.userId} = ${users.id}
        AND ${userMovieLists.status} = 'watching'
      )::int`,
      // Watched count
      watchedCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${userMovieLists}
        WHERE ${userMovieLists.userId} = ${users.id}
        AND ${userMovieLists.status} = 'watched'
      )::int`,
      // Total rooms (as creator or participant)
      roomsTotal: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE ${rooms.userAId} = ${users.id} OR ${rooms.userBId} = ${users.id}
      )::int`.as('rooms_total'),
      // Rooms created (as user A - creator)
      roomsCreated: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE ${rooms.userAId} = ${users.id}
      )::int`,
      // Rooms joined (as user B)
      roomsJoined: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE ${rooms.userBId} = ${users.id}
      )::int`,
      // Matched rooms
      roomsMatched: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE (${rooms.userAId} = ${users.id} OR ${rooms.userBId} = ${users.id})
        AND ${rooms.status} = 'matched'
      )::int`,
      // Session count
      sessionCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${userSessions}
        WHERE ${userSessions.userId} = ${users.id}
      )::int`,
      // Activity: last day
      activityDay: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE (${rooms.userAId} = ${users.id} OR ${rooms.userBId} = ${users.id})
        AND ${rooms.createdAt} >= ${oneDayAgo}
      )::int`,
      // Activity: last week
      activityWeek: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE (${rooms.userAId} = ${users.id} OR ${rooms.userBId} = ${users.id})
        AND ${rooms.createdAt} >= ${oneWeekAgo}
      )::int`.as('activity_week'),
      // Activity: last month
      activityMonth: sql<number>`(
        SELECT COUNT(*)
        FROM ${rooms}
        WHERE (${rooms.userAId} = ${users.id} OR ${rooms.userBId} = ${users.id})
        AND ${rooms.createdAt} >= ${oneMonthAgo}
      )::int`,
    })
    .from(users)
    .orderBy(sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn))
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
