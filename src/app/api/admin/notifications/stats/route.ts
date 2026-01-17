import { db } from '@/lib/db';
import { notificationLog, upcomingMovies } from '@/lib/db/schema';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';
import { eq, sql, desc, and, gte } from 'drizzle-orm';

// GET /api/admin/notifications/stats - Get notification statistics
export const GET = withAdmin(async () => {
  // Get counts by notification type
  const typeCounts = await db
    .select({
      type: notificationLog.type,
      count: sql<number>`count(*)::int`,
      totalSent: sql<number>`sum(${notificationLog.successCount})::int`,
      totalFailed: sql<number>`sum(${notificationLog.failureCount})::int`,
    })
    .from(notificationLog)
    .groupBy(notificationLog.type);

  // Get last 7 days activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity = await db
    .select({
      date: sql<string>`date(${notificationLog.startedAt})`,
      count: sql<number>`count(*)::int`,
      sent: sql<number>`sum(${notificationLog.successCount})::int`,
    })
    .from(notificationLog)
    .where(gte(notificationLog.startedAt, sevenDaysAgo))
    .groupBy(sql`date(${notificationLog.startedAt})`)
    .orderBy(sql`date(${notificationLog.startedAt})`);

  // Get upcoming movies stats
  const upcomingStats = await db
    .select({
      status: upcomingMovies.status,
      count: sql<number>`count(*)::int`,
    })
    .from(upcomingMovies)
    .groupBy(upcomingMovies.status);

  // Get pending notifications (movies not yet notified)
  const pendingAnnouncements = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(upcomingMovies)
    .where(
      and(
        eq(upcomingMovies.status, 'tracked'),
        sql`${upcomingMovies.announcementSentAt} IS NULL`
      )
    );

  // Get recent logs
  const recentLogs = await db
    .select()
    .from(notificationLog)
    .orderBy(desc(notificationLog.startedAt))
    .limit(10);

  // Calculate totals
  const totalNotifications = typeCounts.reduce((sum, t) => sum + t.count, 0);
  const totalSuccess = typeCounts.reduce((sum, t) => sum + (t.totalSent || 0), 0);
  const totalFailed = typeCounts.reduce((sum, t) => sum + (t.totalFailed || 0), 0);

  const byType = typeCounts.reduce(
    (acc, t) => {
      acc[t.type] = {
        count: t.count,
        success: t.totalSent || 0,
        failed: t.totalFailed || 0,
      };
      return acc;
    },
    {} as Record<string, { count: number; success: number; failed: number }>
  );

  const upcomingMoviesStats = {
    total: upcomingStats.reduce((sum, s) => sum + s.count, 0),
    tracked: upcomingStats.find((s) => s.status === 'tracked')?.count || 0,
    released: upcomingStats.find((s) => s.status === 'released')?.count || 0,
    archived: upcomingStats.find((s) => s.status === 'archived')?.count || 0,
  };

  return success({
    data: {
      totalNotifications,
      totalSuccess,
      totalFailed,
      byType,
      recentActivity,
      upcomingMovies: upcomingMoviesStats,
      pendingAnnouncements: pendingAnnouncements[0]?.count || 0,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        type: log.type,
        tmdbId: log.tmdbId,
        totalRecipients: log.totalRecipients,
        successCount: log.successCount,
        failureCount: log.failureCount,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
      })),
    },
  });
});
