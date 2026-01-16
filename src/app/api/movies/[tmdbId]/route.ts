import { NextRequest, NextResponse } from 'next/server';
import { enhanceMovieData, enhanceTVData } from '@/lib/api/moviePool';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Get movie or TV series by TMDB ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId: tmdbIdStr } = await params;
    const tmdbId = parseInt(tmdbIdStr, 10);
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');

    if (!tmdbId || isNaN(tmdbId)) {
      return NextResponse.json(
        { error: 'Invalid tmdbId parameter' },
        { status: 400 }
      );
    }

    // Determine media type: use param if provided, otherwise check database
    let mediaType = typeParam;
    if (!mediaType) {
      const [cached] = await db
        .select({ mediaType: movies.mediaType })
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));
      mediaType = cached?.mediaType || null;
    }

    // Fetch movie data based on media type
    let movie = null;
    if (mediaType === 'tv') {
      movie = await enhanceTVData(tmdbId);
    } else if (mediaType === 'movie') {
      movie = await enhanceMovieData(tmdbId);
    } else {
      // Unknown type - try movie first, then TV as fallback
      movie = await enhanceMovieData(tmdbId);
      if (!movie) {
        movie = await enhanceTVData(tmdbId);
      }
    }

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
