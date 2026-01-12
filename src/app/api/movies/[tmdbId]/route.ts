import { NextRequest, NextResponse } from 'next/server';
import { enhanceMovieData } from '@/lib/api/moviePool';

// Get movie by TMDB ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId: tmdbIdStr } = await params;
    const tmdbId = parseInt(tmdbIdStr, 10);

    if (!tmdbId || isNaN(tmdbId)) {
      return NextResponse.json(
        { error: 'Invalid tmdbId parameter' },
        { status: 400 }
      );
    }

    const movie = await enhanceMovieData(tmdbId);

    if (!movie) {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { movie },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get movie:', error);
    return NextResponse.json(
      { error: 'Failed to get movie' },
      { status: 500 }
    );
  }
}
