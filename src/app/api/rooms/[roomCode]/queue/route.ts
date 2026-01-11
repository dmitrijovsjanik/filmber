import { NextRequest, NextResponse } from 'next/server';
import { buildQueue, type QueueBuildParams } from '@/lib/queue/queueBuilder';
import { getAuthUser } from '@/lib/auth/middleware';

interface RouteParams {
  params: Promise<{ roomCode: string }>;
}

// Get personalized movie queue for a room
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { roomCode } = await params;
    const { searchParams } = new URL(request.url);

    const userSlot = searchParams.get('userSlot') as 'A' | 'B' | null;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!userSlot || !['A', 'B'].includes(userSlot)) {
      return NextResponse.json(
        { error: 'Invalid or missing userSlot parameter' },
        { status: 400 }
      );
    }

    // Get authenticated user (optional)
    const user = await getAuthUser(request);

    const queueParams: QueueBuildParams = {
      roomCode,
      userSlot,
      userId: user?.id,
      limit,
      offset,
    };

    const result = await buildQueue(queueParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to build queue:', error);

    if (error instanceof Error && error.message === 'Room not found') {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to build queue' },
      { status: 500 }
    );
  }
}
