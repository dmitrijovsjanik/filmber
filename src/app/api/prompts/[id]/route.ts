import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { watchPrompts, userMovieLists, MOVIE_STATUS } from '@/lib/db/schema';
import { getAuthUser, unauthorized, badRequest, notFound, success } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

type PromptResponse = 'watched' | 'not_yet' | 'dismissed';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/prompts/[id] - Respond to a prompt
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { response, rating } = body as { response: PromptResponse; rating?: number };

    // Validate response
    if (!['watched', 'not_yet', 'dismissed'].includes(response)) {
      return badRequest('response must be "watched", "not_yet", or "dismissed"');
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || rating < 1 || rating > 3) {
        return badRequest('rating must be 1, 2, or 3');
      }
    }

    // Find the prompt
    const [prompt] = await db
      .select()
      .from(watchPrompts)
      .where(and(eq(watchPrompts.id, id), eq(watchPrompts.userId, user.id)));

    if (!prompt) {
      return notFound('Prompt not found');
    }

    // Update prompt
    const now = new Date();
    const updates: Record<string, unknown> = {
      respondedAt: now,
      response,
    };

    // If "not_yet", snooze for 3 days
    if (response === 'not_yet') {
      updates.snoozeUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      updates.respondedAt = null; // Allow re-prompt after snooze
    }

    await db.update(watchPrompts).set(updates).where(eq(watchPrompts.id, id));

    // If watched, update the movie list entry
    if (response === 'watched') {
      // Find or create list entry
      const [existingEntry] = await db
        .select()
        .from(userMovieLists)
        .where(
          and(eq(userMovieLists.userId, user.id), eq(userMovieLists.tmdbId, prompt.tmdbId))
        );

      if (existingEntry) {
        // Update to watched
        await db
          .update(userMovieLists)
          .set({
            status: MOVIE_STATUS.WATCHED,
            rating: rating || existingEntry.rating,
            watchedAt: now,
            updatedAt: now,
          })
          .where(eq(userMovieLists.id, existingEntry.id));
      } else {
        // Create new entry as watched
        await db.insert(userMovieLists).values({
          userId: user.id,
          tmdbId: prompt.tmdbId,
          status: MOVIE_STATUS.WATCHED,
          rating: rating || null,
          source: 'manual',
          watchedAt: now,
        });
      }
    }

    return success({ success: true, response });
  } catch (error) {
    console.error('Error responding to prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
