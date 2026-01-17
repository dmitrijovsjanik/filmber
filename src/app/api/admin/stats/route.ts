import { db } from '@/lib/db';
import { users, rooms, movies, userMovieLists, userSwipeHistory, userSessions } from '@/lib/db/schema';
import { sql, count, eq, gte, and } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async () => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    totalUsersResult,
    usersLast24hResult,
    usersLast7dResult,
    activeSessionsResult,
    totalMoviesResult,
    totalRoomsResult,
    activeRoomsResult,
    moviesInListsResult,
    swipesTodayResult,
    matchesTodayResult,
    firstUserResult,
    latestUserResult,
  ] = await Promise.all([
    // Total users
    db.select({ count: count() }).from(users),

    // Users registered in last 24h
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, oneDayAgo)),

    // Users registered in last 7 days
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo)),

    // Active sessions (not expired)
    db
      .select({ count: count() })
      .from(userSessions)
      .where(gte(userSessions.expiresAt, now)),

    // Total cached movies
    db.select({ count: count() }).from(movies),

    // Total rooms created
    db.select({ count: count() }).from(rooms),

    // Active rooms (waiting or active status)
    db
      .select({ count: count() })
      .from(rooms)
      .where(sql`${rooms.status} IN ('waiting', 'active')`),

    // Total movies in user lists
    db.select({ count: count() }).from(userMovieLists),

    // Swipes today (from user swipe history)
    db
      .select({ count: count() })
      .from(userSwipeHistory)
      .where(gte(userSwipeHistory.createdAt, oneDayAgo)),

    // Matches today (rooms with matched status created today)
    db
      .select({ count: count() })
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'matched'),
          gte(rooms.createdAt, oneDayAgo)
        )
      ),

    // First user
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .orderBy(users.createdAt)
      .limit(1),

    // Latest user
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(1),
  ]);

  const stats = {
    users: {
      total: totalUsersResult[0]?.count ?? 0,
      last24h: usersLast24hResult[0]?.count ?? 0,
      last7d: usersLast7dResult[0]?.count ?? 0,
      firstUser: firstUserResult[0]?.createdAt ?? null,
      latestUser: latestUserResult[0]?.createdAt ?? null,
    },
    sessions: {
      active: activeSessionsResult[0]?.count ?? 0,
    },
    movies: {
      cached: totalMoviesResult[0]?.count ?? 0,
      inLists: moviesInListsResult[0]?.count ?? 0,
    },
    rooms: {
      total: totalRoomsResult[0]?.count ?? 0,
      active: activeRoomsResult[0]?.count ?? 0,
    },
    activity: {
      swipesToday: swipesTodayResult[0]?.count ?? 0,
      matchesToday: matchesTodayResult[0]?.count ?? 0,
    },
    serverTime: now.toISOString(),
  };

  return success(stats);
});
