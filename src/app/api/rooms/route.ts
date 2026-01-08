import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { generateRoomCode } from '@/lib/utils/roomCode';
import { generatePin } from '@/lib/utils/pin';

// Create a new room
export async function POST() {
  try {
    const code = generateRoomCode();
    const pin = generatePin();
    const seed = Math.floor(Math.random() * 1000000);

    const [room] = await db
      .insert(rooms)
      .values({
        code,
        pin,
        moviePoolSeed: seed,
      })
      .returning();

    return NextResponse.json({
      roomCode: room.code,
      pin: room.pin,
      shareUrl: `/room/${room.code}/link`,
    });
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
