import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { movies } from '@/lib/db/schema';
import { and, isNull, isNotNull, lte, or, gte } from 'drizzle-orm';
import { posterService } from '@/lib/services/posterService';
import { eq } from 'drizzle-orm';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Process up to 50 movies per run
const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Calculate date 7 days ago for recently released movies
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Find movies that need poster download:
    // 1. Movies without local poster that have remote poster available
    // 2. Prioritize:
    //    - Released movies without poster
    //    - Movies released in last 7 days (poster might have been added)
    const moviesNeedingPoster = await db
      .select({
        id: movies.id,
        posterPath: movies.posterPath,
        posterUrl: movies.posterUrl,
        releaseDate: movies.releaseDate,
      })
      .from(movies)
      .where(
        and(
          // No local poster yet
          isNull(movies.localPosterPath),
          // Has remote poster available
          or(
            isNotNull(movies.posterPath),
            isNotNull(movies.posterUrl)
          ),
          // Either already released OR released in last 7 days
          or(
            lte(movies.releaseDate, today),
            and(
              gte(movies.releaseDate, sevenDaysAgoStr),
              lte(movies.releaseDate, today)
            )
          )
        )
      )
      .limit(BATCH_SIZE);

    if (moviesNeedingPoster.length === 0) {
      return NextResponse.json({
        message: 'No posters to update',
        updated: 0,
      });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const movie of moviesNeedingPoster) {
      try {
        const sourceUrl = posterService.getSourceUrl(
          movie.posterPath,
          movie.posterUrl
        );

        if (!sourceUrl) {
          continue;
        }

        const localPath = await posterService.downloadAndSave(sourceUrl, movie.id);

        if (localPath) {
          await db
            .update(movies)
            .set({ localPosterPath: localPath })
            .where(eq(movies.id, movie.id));
          updatedCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Movie ${movie.id}: ${errorMsg}`);
        console.error(`Failed to update poster for ${movie.id}:`, error);
      }
    }

    return NextResponse.json({
      message: 'Posters updated',
      updated: updatedCount,
      total: moviesNeedingPoster.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also handle POST for services that require POST for cron
export async function POST(request: NextRequest) {
  return GET(request);
}
