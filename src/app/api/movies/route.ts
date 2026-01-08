import { NextRequest, NextResponse } from 'next/server';
import { generateMoviePool } from '@/lib/api/moviePool';

// Get movie pool for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seed = parseInt(searchParams.get('seed') || '0', 10);

    if (!seed) {
      return NextResponse.json(
        { error: 'Seed parameter is required' },
        { status: 400 }
      );
    }

    const movies = await generateMoviePool(seed);

    return NextResponse.json({ movies });
  } catch (error) {
    console.error('Failed to get movies:', error);
    return NextResponse.json(
      { error: 'Failed to get movies' },
      { status: 500 }
    );
  }
}
