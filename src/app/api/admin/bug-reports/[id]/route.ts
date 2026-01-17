import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { bugReports } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminUser } from '@/lib/auth/admin';
import { success, unauthorized, notFound, badRequest } from '@/lib/auth/middleware';

// POST /api/admin/bug-reports/[id] - Reply to a bug report
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(request);
  if (!user) {
    return unauthorized('Admin access required');
  }

  const { id } = await params;
  const body = await request.json();
  const { reply, status } = body;

  if (!reply && !status) {
    return badRequest('Reply or status is required');
  }

  // Check if report exists
  const [report] = await db
    .select()
    .from(bugReports)
    .where(eq(bugReports.id, id));

  if (!report) {
    return notFound('Bug report not found');
  }

  // Update the report
  const updateData: {
    adminReply?: string;
    repliedAt?: Date;
    repliedBy?: string;
    status?: string;
  } = {};

  if (reply) {
    updateData.adminReply = reply;
    updateData.repliedAt = new Date();
    updateData.repliedBy = user.id;
    updateData.status = 'replied';
  }

  if (status) {
    updateData.status = status;
  }

  const [updated] = await db
    .update(bugReports)
    .set(updateData)
    .where(eq(bugReports.id, id))
    .returning();

  // Send reply to user via Telegram bot
  if (reply && report.telegramId) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const message = `📬 Ответ на ваш репорт:\n\n${reply}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: report.telegramId,
            text: message,
          }),
        });
      }
    } catch (error) {
      console.error('Failed to send reply to user:', error);
    }
  }

  return success(updated);
}

// PATCH /api/admin/bug-reports/[id] - Update status only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(request);
  if (!user) {
    return unauthorized('Admin access required');
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !['open', 'replied', 'closed'].includes(status)) {
    return badRequest('Valid status is required (open, replied, closed)');
  }

  const [updated] = await db
    .update(bugReports)
    .set({ status })
    .where(eq(bugReports.id, id))
    .returning();

  if (!updated) {
    return notFound('Bug report not found');
  }

  return success(updated);
}
