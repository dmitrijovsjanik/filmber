import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ roomCode: string }>;
}

// Join a room
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { pin, viaLink } = await request.json();
    const { roomCode } = await params;

    const [room] = await db.select().from(rooms).where(eq(rooms.code, roomCode));

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check PIN (skip if joining via direct link)
    if (!viaLink && room.pin !== pin) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Check room status
    if (room.status === 'expired') {
      return NextResponse.json({ error: 'Room has expired' }, { status: 410 });
    }

    if (room.status === 'matched') {
      return NextResponse.json(
        { error: 'Room already has a match' },
        { status: 409 }
      );
    }

    // Determine user slot
    let userSlot: 'A' | 'B';
    if (!room.userAConnected) {
      userSlot = 'A';
    } else if (!room.userBConnected) {
      userSlot = 'B';
    } else {
      return NextResponse.json({ error: 'Room is full' }, { status: 409 });
    }

    return NextResponse.json({
      roomCode: room.code,
      userSlot,
      moviePoolSeed: room.moviePoolSeed,
    });
  } catch (error) {
    console.error('Failed to join room:', error);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}
