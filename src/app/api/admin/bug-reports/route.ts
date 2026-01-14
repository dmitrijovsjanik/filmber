import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bugReports } from '@/lib/db/schema';
import { desc, count, eq } from 'drizzle-orm';
import { withAdmin } from '@/lib/auth/admin';
import { success } from '@/lib/auth/middleware';

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;
  const status = searchParams.get('status'); // Optional filter: 'open' | 'replied' | 'closed'

  // Build where clause
  const whereClause = status ? eq(bugReports.status, status) : undefined;

  // Get bug reports
  const reports = await db
    .select()
    .from(bugReports)
    .where(whereClause)
    .orderBy(desc(bugReports.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(bugReports)
    .where(whereClause);
  const total = totalResult?.count ?? 0;

  // Get counts by status
  const [openCount] = await db
    .select({ count: count() })
    .from(bugReports)
    .where(eq(bugReports.status, 'open'));

  const [repliedCount] = await db
    .select({ count: count() })
    .from(bugReports)
    .where(eq(bugReports.status, 'replied'));

  return success({
    data: reports,
    counts: {
      open: openCount?.count ?? 0,
      replied: repliedCount?.count ?? 0,
      total,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
