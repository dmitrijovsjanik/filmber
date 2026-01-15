import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { upcomingMovies, UPCOMING_MOVIE_STATUS } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/upcoming - Get list of upcoming movies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const status = searchParams.get('status') || 'tracked';

    const movies = await db
      .select({
        id: upcomingMovies.id,
        tmdbId: upcomingMovies.tmdbId,
        title: upcomingMovies.title,
        titleRu: upcomingMovies.titleRu,
        posterPath: upcomingMovies.posterPath,
        overview: upcomingMovies.overview,
        overviewRu: upcomingMovies.overviewRu,
        genres: upcomingMovies.genres,
        popularity: upcomingMovies.popularity,
        theatricalReleaseUs: upcomingMovies.theatricalReleaseUs,
        theatricalReleaseRu: upcomingMovies.theatricalReleaseRu,
        digitalRelease: upcomingMovies.digitalRelease,
        status: upcomingMovies.status,
        discoveredAt: upcomingMovies.discoveredAt,
      })
      .from(upcomingMovies)
      .where(eq(upcomingMovies.status, status as typeof UPCOMING_MOVIE_STATUS.TRACKED))
      .orderBy(desc(upcomingMovies.popularity))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: movies,
      count: movies.length,
    });
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upcoming movies' },
      { status: 500 }
    );
  }
}
