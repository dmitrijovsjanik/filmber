import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rooms, swipes, users } from '@/lib/db/schema';
import { sql, eq, and, gte, isNotNull, isNull, count } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

interface TimeRange {
  label: string;
  from: Date;
}

function getTimeRanges(): TimeRange[] {
  const now = new Date();
  return [
    { label: 'today', from: new Date(now.setHours(0, 0, 0, 0)) },
    { label: 'week', from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    { label: 'month', from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    { label: 'all', from: new Date(0) },
  ];
}

export const GET = withAdmin(async (request: NextRequest) => {
  const timeRanges = getTimeRanges();
  const analytics: Record<string, unknown> = {};

  for (const range of timeRanges) {
    // Get room stats by status
    const statusStats = await db
      .select({
        status: rooms.status,
        count: count(),
      })
      .from(rooms)
      .where(gte(rooms.createdAt, range.from))
      .groupBy(rooms.status);

    const statusMap: Record<string, number> = {};
    let totalRooms = 0;
    statusStats.forEach((s) => {
      statusMap[s.status] = s.count;
      totalRooms += s.count;
    });

    // Get rooms with users (authenticated vs anonymous)
    const [authStats] = await db
      .select({
        withAuth: sql<number>`COUNT(*) FILTER (WHERE ${rooms.userAId} IS NOT NULL OR ${rooms.userBId} IS NOT NULL)::int`,
        bothAuth: sql<number>`COUNT(*) FILTER (WHERE ${rooms.userAId} IS NOT NULL AND ${rooms.userBId} IS NOT NULL)::int`,
        anonymous: sql<number>`COUNT(*) FILTER (WHERE ${rooms.userAId} IS NULL AND ${rooms.userBId} IS NULL)::int`,
      })
      .from(rooms)
      .where(gte(rooms.createdAt, range.from));

    // Get average swipes per room (for matched rooms)
    const [swipeStats] = await db
      .select({
        avgSwipesToMatch: sql<number>`
          COALESCE(AVG(swipe_count)::numeric(10,1), 0)
          FROM (
            SELECT COUNT(*) as swipe_count
            FROM ${swipes}
            WHERE ${swipes.roomId} IN (
              SELECT id FROM ${rooms}
              WHERE ${rooms.status} = 'matched'
              AND ${rooms.createdAt} >= ${range.from}
            )
            GROUP BY ${swipes.roomId}
          ) sub
        `,
        totalSwipes: sql<number>`(
          SELECT COUNT(*)
          FROM ${swipes} s
          JOIN ${rooms} r ON s.room_id = r.id
          WHERE r.created_at >= ${range.from}
        )::int`,
      })
      .from(sql`(SELECT 1) as dummy`);

    // Get top matched movies
    const topMatches = await db
      .select({
        movieId: rooms.matchedMovieId,
        count: count(),
      })
      .from(rooms)
      .where(
        and(
          gte(rooms.createdAt, range.from),
          isNotNull(rooms.matchedMovieId)
        )
      )
      .groupBy(rooms.matchedMovieId)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    // Calculate rates
    const matchedCount = statusMap['matched'] || 0;
    const expiredCount = statusMap['expired'] || 0;
    const activeCount = statusMap['active'] || 0;
    const waitingCount = statusMap['waiting'] || 0;

    // Rooms that could have matched but didn't
    const completedRooms = matchedCount + expiredCount;
    const matchRate = completedRooms > 0 ? ((matchedCount / completedRooms) * 100).toFixed(1) : '0';
    const abandonmentRate = completedRooms > 0 ? ((expiredCount / completedRooms) * 100).toFixed(1) : '0';

    analytics[range.label] = {
      totalRooms,
      byStatus: {
        waiting: waitingCount,
        active: activeCount,
        matched: matchedCount,
        expired: expiredCount,
      },
      rates: {
        matchRate: parseFloat(matchRate),
        abandonmentRate: parseFloat(abandonmentRate),
      },
      auth: {
        withAuth: authStats?.withAuth || 0,
        bothAuth: authStats?.bothAuth || 0,
        anonymous: authStats?.anonymous || 0,
      },
      swipes: {
        total: swipeStats?.totalSwipes || 0,
        avgToMatch: swipeStats?.avgSwipesToMatch || 0,
      },
      topMatches: topMatches.map((m) => ({
        movieId: m.movieId,
        count: m.count,
      })),
    };
  }

  // Get hourly distribution (last 7 days)
  const hourlyDistribution = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${rooms.createdAt})::int`,
      count: count(),
    })
    .from(rooms)
    .where(gte(rooms.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
    .groupBy(sql`EXTRACT(HOUR FROM ${rooms.createdAt})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${rooms.createdAt})`);

  // Get daily distribution (last 30 days)
  const dailyDistribution = await db
    .select({
      date: sql<string>`DATE(${rooms.createdAt})::text`,
      total: count(),
      matched: sql<number>`COUNT(*) FILTER (WHERE ${rooms.status} = 'matched')::int`,
    })
    .from(rooms)
    .where(gte(rooms.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    .groupBy(sql`DATE(${rooms.createdAt})`)
    .orderBy(sql`DATE(${rooms.createdAt})`);

  return success({
    analytics,
    distributions: {
      hourly: hourlyDistribution,
      daily: dailyDistribution,
    },
  });
});
