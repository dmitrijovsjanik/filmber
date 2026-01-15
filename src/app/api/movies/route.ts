import { NextRequest, NextResponse } from 'next/server';
import { generatePaginatedMoviePool, type SupportedLocale } from '@/lib/api/moviePool';
import type { MediaTypeFilter } from '@/types/movie';

// Get movie pool for a room (solo mode)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seed = parseInt(searchParams.get('seed') || '0', 10);
    const mediaTypeParam = searchParams.get('mediaType');
    const localeParam = searchParams.get('locale');

    // Validate mediaType parameter
    const validMediaTypes: MediaTypeFilter[] = ['all', 'movie', 'tv'];
    const mediaTypeFilter: MediaTypeFilter =
      mediaTypeParam && validMediaTypes.includes(mediaTypeParam as MediaTypeFilter)
        ? (mediaTypeParam as MediaTypeFilter)
        : 'all';

    // Parse locale
    const locale: SupportedLocale = localeParam === 'ru' ? 'ru' : 'en';

    if (!seed) {
      return NextResponse.json(
        { error: 'Seed parameter is required' },
        { status: 400 }
      );
    }

    // Use paginated pool with larger limit for solo mode (fewer API calls needed)
    const { movies } = await generatePaginatedMoviePool(seed, 0, 100, mediaTypeFilter, locale);

    return NextResponse.json(
      { movies },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get movies:', error);
    return NextResponse.json(
      { error: 'Failed to get movies' },
      { status: 500 }
    );
  }
}
