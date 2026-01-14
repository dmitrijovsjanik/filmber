import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms, swipes, roomQueues, watchPrompts } from '@/lib/db/schema';
import { eq, lt, and, or, isNotNull, inArray } from 'drizzle-orm';
import { cleanupExpiredSessions } from '@/lib/auth/session';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Retention periods
const ABANDONED_WAITING_ROOMS_HOURS = 1; // Delete waiting rooms with no users after 1 hour
const STALE_ACTIVE_ROOMS_HOURS = 2; // Delete active rooms with no activity after 2 hours
const MATCHED_ROOMS_RETENTION_DAYS = 30; // Keep matched rooms for 30 days (important data)
const EXPIRED_ROOMS_RETENTION_DAYS = 7; // Delete expired (non-matched) rooms after 7 days
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
      abandonedWaitingRooms: 0,
      staleActiveRooms: 0,
      expiredRooms: 0,
      deletedSwipes: 0,
      deletedRoomQueues: 0,
      oldPrompts: 0,
    };

    // 1. Cleanup expired sessions
    results.expiredSessions = await cleanupExpiredSessions();

    // 2. Cleanup abandoned waiting rooms (no users connected, older than 1 hour)
    const abandonedWaitingCutoff = new Date(
      Date.now() - ABANDONED_WAITING_ROOMS_HOURS * 60 * 60 * 1000
    );

    const abandonedWaitingRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'waiting'),
          eq(rooms.userAConnected, false),
          eq(rooms.userBConnected, false),
          lt(rooms.createdAt, abandonedWaitingCutoff)
        )
      );

    if (abandonedWaitingRooms.length > 0) {
      const roomIds = abandonedWaitingRooms.map((r) => r.id);
      await db.delete(roomQueues).where(inArray(roomQueues.roomId, roomIds));
      await db.delete(swipes).where(inArray(swipes.roomId, roomIds));
      await db.delete(rooms).where(inArray(rooms.id, roomIds));
      results.abandonedWaitingRooms = abandonedWaitingRooms.length;
    }

    // 3. Cleanup stale active rooms (no match after 2 hours - users left without matching)
    const staleActiveCutoff = new Date(
      Date.now() - STALE_ACTIVE_ROOMS_HOURS * 60 * 60 * 1000
    );

    const staleActiveRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          or(
            eq(rooms.status, 'waiting'),
            eq(rooms.status, 'active')
          ),
          lt(rooms.createdAt, staleActiveCutoff)
        )
      );

    if (staleActiveRooms.length > 0) {
      const roomIds = staleActiveRooms.map((r) => r.id);
      await db.delete(roomQueues).where(inArray(roomQueues.roomId, roomIds));
      await db.delete(swipes).where(inArray(swipes.roomId, roomIds));
      await db.delete(rooms).where(inArray(rooms.id, roomIds));
      results.staleActiveRooms = staleActiveRooms.length;
    }

    // 4. Cleanup expired rooms WITHOUT matches (older than 7 days)
    const expiredRoomsCutoff = new Date(
      Date.now() - EXPIRED_ROOMS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const expiredRoomsNoMatch = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'expired'),
          lt(rooms.expiresAt, expiredRoomsCutoff)
        )
      );

    if (expiredRoomsNoMatch.length > 0) {
      const roomIds = expiredRoomsNoMatch.map((r) => r.id);

      // Delete related swipes
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
      results.expiredRooms = expiredRoomsNoMatch.length;
    }

    // 5. Cleanup matched rooms older than 30 days (keep match history longer)
    const matchedRoomsCutoff = new Date(
      Date.now() - MATCHED_ROOMS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const oldMatchedRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'matched'),
          lt(rooms.createdAt, matchedRoomsCutoff)
        )
      );

    if (oldMatchedRooms.length > 0) {
      const roomIds = oldMatchedRooms.map((r) => r.id);
      await db.delete(roomQueues).where(inArray(roomQueues.roomId, roomIds));
      await db.delete(swipes).where(inArray(swipes.roomId, roomIds));
      await db.delete(rooms).where(inArray(rooms.id, roomIds));
      // Count these as expired rooms in the result
      results.expiredRooms += oldMatchedRooms.length;
    }

    // 6. Cleanup old responded watch prompts (older than 30 days)
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
