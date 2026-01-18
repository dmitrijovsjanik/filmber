import { db } from '@/lib/db';
import { users, rooms, movies, userMovieLists, userSwipeHistory, userSessions, swipes } from '@/lib/db/schema';
import { sql, count, eq, gte, and, lt, isNotNull, countDistinct, or, avg } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async () => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

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
    // Active users (DAU/WAU/MAU)
    dauResult,
    wauResult,
    mauResult,
    // Retention cohorts
    d1CohortResult,
    d1ReturnedResult,
    d7CohortResult,
    d7ReturnedResult,
    d30CohortResult,
    d30ReturnedResult,
    // Virality (K-factor)
    totalReferralsResult,
    usersWithReferralsResult,
    // Daily growth
    dailyGrowthResult,
    // Funnel conversion
    roomsWithConnectionResult,
    roomsWithOneAuthResult,
    roomsWithBothAuthResult,
    // Session depth
    avgSwipesPerRoomResult,
    avgSwipesPerUserResult,
    totalRoomSwipesResult,
    totalUserSwipesResult,
    // Guest to auth conversion
    usersWithSwipeSyncResult,
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

    // === Active Users (DAU/WAU/MAU) ===
    // DAU: users active in last 24h
    db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .where(gte(users.lastSeenAt, oneDayAgo)),

    // WAU: users active in last 7 days
    db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .where(gte(users.lastSeenAt, sevenDaysAgo)),

    // MAU: users active in last 30 days
    db
      .select({ count: countDistinct(users.id) })
      .from(users)
      .where(gte(users.lastSeenAt, thirtyDaysAgo)),

    // === Retention Cohorts ===
    // D1: users registered 1-2 days ago
    db
      .select({ count: count() })
      .from(users)
      .where(and(gte(users.createdAt, twoDaysAgo), lt(users.createdAt, oneDayAgo))),

    // D1 returned: users registered 1-2 days ago who came back after 1 day
    db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, twoDaysAgo),
          lt(users.createdAt, oneDayAgo),
          sql`${users.lastSeenAt} >= ${users.createdAt} + interval '1 day'`
        )
      ),

    // D7: users registered 7-8 days ago
    db
      .select({ count: count() })
      .from(users)
      .where(and(gte(users.createdAt, eightDaysAgo), lt(users.createdAt, sevenDaysAgo))),

    // D7 returned: users registered 7-8 days ago who came back after 7 days
    db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, eightDaysAgo),
          lt(users.createdAt, sevenDaysAgo),
          sql`${users.lastSeenAt} >= ${users.createdAt} + interval '7 days'`
        )
      ),

    // D30: users registered 30-31 days ago
    db
      .select({ count: count() })
      .from(users)
      .where(and(gte(users.createdAt, thirtyOneDaysAgo), lt(users.createdAt, thirtyDaysAgo))),

    // D30 returned: users registered 30-31 days ago who came back after 30 days
    db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, thirtyOneDaysAgo),
          lt(users.createdAt, thirtyDaysAgo),
          sql`${users.lastSeenAt} >= ${users.createdAt} + interval '30 days'`
        )
      ),

    // === Virality (K-factor) ===
    // Total referrals (users who were referred by someone)
    db
      .select({ count: count() })
      .from(users)
      .where(isNotNull(users.referredById)),

    // Users who referred at least one person
    db
      .select({ count: countDistinct(users.referredById) })
      .from(users)
      .where(isNotNull(users.referredById)),

    // === Daily Growth (last 30 days) ===
    db
      .select({
        date: sql<string>`TO_CHAR(${users.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
      .groupBy(sql`TO_CHAR(${users.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${users.createdAt}, 'YYYY-MM-DD')`),

    // === Funnel: Room Auth Conversion ===
    // Total rooms with at least one user connected
    db
      .select({ count: count() })
      .from(rooms)
      .where(or(eq(rooms.userAConnected, true), eq(rooms.userBConnected, true))),

    // Rooms where at least one user authenticated
    db
      .select({ count: count() })
      .from(rooms)
      .where(or(isNotNull(rooms.userAId), isNotNull(rooms.userBId))),

    // Rooms where both users authenticated
    db
      .select({ count: count() })
      .from(rooms)
      .where(and(isNotNull(rooms.userAId), isNotNull(rooms.userBId))),

    // === Session Depth ===
    // Average swipes per room (for pair mode depth)
    db
      .select({
        avgSwipes: avg(sql<number>`swipe_count`),
      })
      .from(
        db
          .select({
            roomId: swipes.roomId,
            swipeCount: sql<number>`COUNT(*)`.as('swipe_count'),
          })
          .from(swipes)
          .groupBy(swipes.roomId)
          .as('room_swipes')
      ),

    // Average swipes per user (for solo mode depth)
    db
      .select({
        avgSwipes: avg(sql<number>`swipe_count`),
      })
      .from(
        db
          .select({
            oderId: userSwipeHistory.userId,
            swipeCount: sql<number>`COUNT(*)`.as('swipe_count'),
          })
          .from(userSwipeHistory)
          .groupBy(userSwipeHistory.userId)
          .as('user_swipes')
      ),

    // Total swipes (all time)
    db.select({ count: count() }).from(swipes),
    db.select({ count: count() }).from(userSwipeHistory),

    // === Guest to Auth Conversion ===
    // Users who have synced swipes from anonymous session (source = 'swipe')
    db
      .select({ count: countDistinct(userMovieLists.userId) })
      .from(userMovieLists)
      .where(eq(userMovieLists.source, 'swipe')),
  ]);

  // Calculate retention rates
  const d1Cohort = d1CohortResult[0]?.count ?? 0;
  const d1Returned = d1ReturnedResult[0]?.count ?? 0;
  const d7Cohort = d7CohortResult[0]?.count ?? 0;
  const d7Returned = d7ReturnedResult[0]?.count ?? 0;
  const d30Cohort = d30CohortResult[0]?.count ?? 0;
  const d30Returned = d30ReturnedResult[0]?.count ?? 0;

  // Calculate K-factor
  const totalReferrals = totalReferralsResult[0]?.count ?? 0;
  const usersWithReferrals = usersWithReferralsResult[0]?.count ?? 0;
  const kFactor = usersWithReferrals > 0 ? totalReferrals / usersWithReferrals : 0;

  // Calculate funnel conversion
  const roomsWithConnection = roomsWithConnectionResult[0]?.count ?? 0;
  const roomsWithOneAuth = roomsWithOneAuthResult[0]?.count ?? 0;
  const roomsWithBothAuth = roomsWithBothAuthResult[0]?.count ?? 0;

  // Calculate session depth
  const avgSwipesPerRoom = Number(avgSwipesPerRoomResult[0]?.avgSwipes) || 0;
  const avgSwipesPerUser = Number(avgSwipesPerUserResult[0]?.avgSwipes) || 0;
  const totalRoomSwipes = totalRoomSwipesResult[0]?.count ?? 0;
  const totalUserSwipes = totalUserSwipesResult[0]?.count ?? 0;

  // Guest to auth conversion
  const usersWithSwipeSync = usersWithSwipeSyncResult[0]?.count ?? 0;
  const totalUsers = totalUsersResult[0]?.count ?? 0;

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
    // New analytics metrics
    activeUsers: {
      dau: dauResult[0]?.count ?? 0,
      wau: wauResult[0]?.count ?? 0,
      mau: mauResult[0]?.count ?? 0,
    },
    retention: {
      d1: {
        cohort: d1Cohort,
        returned: d1Returned,
        rate: d1Cohort > 0 ? Math.round((d1Returned / d1Cohort) * 100) : 0,
      },
      d7: {
        cohort: d7Cohort,
        returned: d7Returned,
        rate: d7Cohort > 0 ? Math.round((d7Returned / d7Cohort) * 100) : 0,
      },
      d30: {
        cohort: d30Cohort,
        returned: d30Returned,
        rate: d30Cohort > 0 ? Math.round((d30Returned / d30Cohort) * 100) : 0,
      },
    },
    virality: {
      totalReferrals,
      usersWithReferrals,
      kFactor: Math.round(kFactor * 100) / 100, // Round to 2 decimal places
    },
    growth: {
      daily: dailyGrowthResult.map((row) => ({
        date: row.date,
        count: row.count,
      })),
    },
    // Funnel: Room auth conversion
    funnel: {
      roomsWithConnection,
      roomsWithOneAuth,
      roomsWithBothAuth,
      authRate: roomsWithConnection > 0
        ? Math.round((roomsWithOneAuth / roomsWithConnection) * 100)
        : 0,
      bothAuthRate: roomsWithConnection > 0
        ? Math.round((roomsWithBothAuth / roomsWithConnection) * 100)
        : 0,
      // Guest to auth conversion (users who synced anonymous swipes)
      usersWithSwipeSync,
      guestToAuthRate: totalUsers > 0
        ? Math.round((usersWithSwipeSync / totalUsers) * 100)
        : 0,
    },
    // Session depth
    sessionDepth: {
      avgSwipesPerRoom: Math.round(avgSwipesPerRoom * 10) / 10,
      avgSwipesPerUser: Math.round(avgSwipesPerUser * 10) / 10,
      totalRoomSwipes,
      totalUserSwipes,
    },
    serverTime: now.toISOString(),
  };

  return success(stats);
});
