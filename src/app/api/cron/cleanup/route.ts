import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms, swipes, roomQueues, watchPrompts } from '@/lib/db/schema';
import { eq, lt, and, isNotNull, inArray } from 'drizzle-orm';
import { cleanupExpiredSessions } from '@/lib/auth/session';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Retention periods
const EXPIRED_ROOMS_RETENTION_DAYS = 7;
const RESPONDED_PROMPTS_RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  return handleCleanup(request);
}

export async function POST(request: NextRequest) {
  return handleCleanup(request);
}

async function handleCleanup(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      expiredSessions: 0,
      expiredRooms: 0,
      deletedSwipes: 0,
      deletedRoomQueues: 0,
      oldPrompts: 0,
    };

    // 1. Cleanup expired sessions
    results.expiredSessions = await cleanupExpiredSessions();

    // 2. Cleanup expired rooms (older than 7 days)
    const expiredRoomsCutoff = new Date(
      Date.now() - EXPIRED_ROOMS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    // Find expired rooms to delete
    const expiredRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'expired'),
          lt(rooms.expiresAt, expiredRoomsCutoff)
        )
      );

    if (expiredRooms.length > 0) {
      const roomIds = expiredRooms.map((r) => r.id);

      // Delete related swipes (CASCADE should handle this, but be explicit)
      const deletedSwipes = await db
        .delete(swipes)
        .where(inArray(swipes.roomId, roomIds))
        .returning({ id: swipes.id });
      results.deletedSwipes = deletedSwipes.length;

      // Delete related room_queues
      const deletedQueues = await db
        .delete(roomQueues)
        .where(inArray(roomQueues.roomId, roomIds))
        .returning({ id: roomQueues.id });
      results.deletedRoomQueues = deletedQueues.length;

      // Delete the rooms themselves
      await db.delete(rooms).where(inArray(rooms.id, roomIds));
      results.expiredRooms = expiredRooms.length;
    }

    // 3. Cleanup old responded watch prompts (older than 30 days)
    const oldPromptsCutoff = new Date(
      Date.now() - RESPONDED_PROMPTS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const deletedPrompts = await db
      .delete(watchPrompts)
      .where(
        and(
          isNotNull(watchPrompts.respondedAt),
          lt(watchPrompts.respondedAt, oldPromptsCutoff)
        )
      )
      .returning({ id: watchPrompts.id });
    results.oldPrompts = deletedPrompts.length;

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup', details: String(error) },
      { status: 500 }
    );
  }
}
