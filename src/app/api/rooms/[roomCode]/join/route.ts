import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth/middleware';

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

    // Associate authenticated user with slot (for personalized queue)
    const user = await getAuthUser(request);
    if (user) {
      const updateField =
        userSlot === 'A' ? { userAId: user.id } : { userBId: user.id };
      await db.update(rooms).set(updateField).where(eq(rooms.code, roomCode));
    }

    // Get partner's auth status for response
    const partnerId = userSlot === 'A' ? room.userBId : room.userAId;

    return NextResponse.json({
      roomCode: room.code,
      userSlot,
      moviePoolSeed: room.moviePoolSeed,
      isPartnerAuthenticated: !!partnerId,
      partnerId: partnerId ?? null,
    });
  } catch (error) {
    console.error('Failed to join room:', error);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}
