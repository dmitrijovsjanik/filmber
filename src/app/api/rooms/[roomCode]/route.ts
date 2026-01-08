import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ roomCode: string }>;
}

// Get room info
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { roomCode } = await params;

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, roomCode));

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      code: room.code,
      status: room.status,
      userAConnected: room.userAConnected,
      userBConnected: room.userBConnected,
      matchedMovieId: room.matchedMovieId,
      expiresAt: room.expiresAt,
    });
  } catch (error) {
    console.error('Failed to get room:', error);
    return NextResponse.json(
      { error: 'Failed to get room info' },
      { status: 500 }
    );
  }
}

// Delete/close room
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { roomCode } = await params;

    await db.update(rooms).set({ status: 'expired' }).where(eq(rooms.code, roomCode));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to close room:', error);
    return NextResponse.json(
      { error: 'Failed to close room' },
      { status: 500 }
    );
  }
}
