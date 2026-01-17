import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';

// Get trailer for a movie or TV series
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId: tmdbIdStr } = await params;
    const tmdbId = parseInt(tmdbIdStr, 10);
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'movie';

    if (!tmdbId || isNaN(tmdbId)) {
      return NextResponse.json(
        { error: 'Invalid tmdbId parameter' },
        { status: 400 }
      );
    }

    const videos = mediaType === 'tv'
      ? await tmdb.getTVVideos(tmdbId)
      : await tmdb.getMovieVideos(tmdbId);

    if (!videos.length) {
      return NextResponse.json(
        { error: 'No trailer found' },
        { status: 404 }
      );
    }

    // Return the best trailer (first one after sorting)
    const trailer = videos[0];

    return NextResponse.json(
      {
        trailer: {
          key: trailer.key,
          name: trailer.name,
          type: trailer.type,
          site: trailer.site, // 'YouTube' or 'Vimeo'
        }
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get trailer:', error);
    return NextResponse.json(
      { error: 'Failed to get trailer' },
      { status: 500 }
    );
  }
}
