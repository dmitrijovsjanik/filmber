import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deckSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth/middleware';

// Get deck settings
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [settings] = await db
      .select()
      .from(deckSettings)
      .where(eq(deckSettings.userId, user.id));

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        showWatchedMovies: false,
        minRatingFilter: null,
        mediaTypeFilter: 'all',
      });
    }

    return NextResponse.json({
      showWatchedMovies: settings.showWatchedMovies,
      minRatingFilter: settings.minRatingFilter,
      mediaTypeFilter: settings.mediaTypeFilter ?? 'all',
    });
  } catch (error) {
    console.error('Failed to get deck settings:', error);
    return NextResponse.json(
      { error: 'Failed to get deck settings' },
      { status: 500 }
    );
  }
}

// Update deck settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { showWatchedMovies, minRatingFilter, mediaTypeFilter } = body;

    // Validate minRatingFilter
    if (
      minRatingFilter !== null &&
      minRatingFilter !== undefined &&
      ![1, 2, 3].includes(minRatingFilter)
    ) {
      return NextResponse.json(
        { error: 'minRatingFilter must be 1, 2, 3, or null' },
        { status: 400 }
      );
    }

    // Validate mediaTypeFilter
    if (
      mediaTypeFilter !== undefined &&
      !['all', 'movie', 'tv'].includes(mediaTypeFilter)
    ) {
      return NextResponse.json(
        { error: 'mediaTypeFilter must be "all", "movie", or "tv"' },
        { status: 400 }
      );
    }

    const updateData: {
      showWatchedMovies?: boolean;
      minRatingFilter?: number | null;
      mediaTypeFilter?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (typeof showWatchedMovies === 'boolean') {
      updateData.showWatchedMovies = showWatchedMovies;
    }

    if (minRatingFilter !== undefined) {
      updateData.minRatingFilter = minRatingFilter;
    }

    if (mediaTypeFilter !== undefined) {
      updateData.mediaTypeFilter = mediaTypeFilter;
    }

    // Upsert settings
    const [existing] = await db
      .select()
      .from(deckSettings)
      .where(eq(deckSettings.userId, user.id));

    if (existing) {
      await db
        .update(deckSettings)
        .set(updateData)
        .where(eq(deckSettings.userId, user.id));
    } else {
      await db.insert(deckSettings).values({
        userId: user.id,
        showWatchedMovies: showWatchedMovies ?? false,
        minRatingFilter: minRatingFilter ?? null,
        mediaTypeFilter: mediaTypeFilter ?? 'all',
      });
    }

    // Fetch and return updated settings
    const [updated] = await db
      .select()
      .from(deckSettings)
      .where(eq(deckSettings.userId, user.id));

    return NextResponse.json({
      showWatchedMovies: updated?.showWatchedMovies ?? false,
      minRatingFilter: updated?.minRatingFilter ?? null,
      mediaTypeFilter: updated?.mediaTypeFilter ?? 'all',
    });
  } catch (error) {
    console.error('Failed to update deck settings:', error);
    return NextResponse.json(
      { error: 'Failed to update deck settings' },
      { status: 500 }
    );
  }
}
