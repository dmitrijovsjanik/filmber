import { NextRequest, NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  try {
    const { id: idStr, seasonNumber: seasonStr } = await params;
    const tvId = parseInt(idStr, 10);
    const seasonNumber = parseInt(seasonStr, 10);

    if (!tvId || isNaN(tvId)) {
      return NextResponse.json(
        { error: 'Invalid id parameter' },
        { status: 400 }
      );
    }

    if (isNaN(seasonNumber) || seasonNumber < 0) {
      return NextResponse.json(
        { error: 'Invalid seasonNumber parameter' },
        { status: 400 }
      );
    }

    // Get locale from query params (default to en-US)
    const locale = request.nextUrl.searchParams.get('locale');
    const language: 'en-US' | 'ru-RU' = locale === 'ru' ? 'ru-RU' : 'en-US';

    const season = await tmdb.getSeasonDetails(tvId, seasonNumber, language);

    return NextResponse.json(
      { season },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get season details:', error);
    return NextResponse.json(
      { error: 'Failed to get season details' },
      { status: 500 }
    );
  }
}
