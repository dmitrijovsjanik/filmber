import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { watchPrompts, userMovieLists, movies, MOVIE_STATUS, type Movie } from '@/lib/db/schema';
import { getAuthUser, unauthorized, success } from '@/lib/auth/middleware';
import { eq, and, isNull, lt, or, desc } from 'drizzle-orm';

// GET /api/prompts - Get pending watch prompts
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const now = new Date();

  // Get pending prompts (not responded or snoozed until past)
  const prompts = await db
    .select({
      prompt: watchPrompts,
      movie: movies,
    })
    .from(watchPrompts)
    .leftJoin(movies, eq(watchPrompts.tmdbId, movies.tmdbId))
    .where(
      and(
        eq(watchPrompts.userId, user.id),
        isNull(watchPrompts.respondedAt),
        or(isNull(watchPrompts.snoozeUntil), lt(watchPrompts.snoozeUntil, now))
      )
    )
    .orderBy(desc(watchPrompts.promptedAt))
    .limit(5);

  // If no prompts exist, generate some from "want to watch" list
  if (prompts.length === 0) {
    // Find movies added to "want to watch" more than 7 days ago
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await db
      .select({
        list: userMovieLists,
        movie: movies,
      })
      .from(userMovieLists)
      .leftJoin(movies, eq(userMovieLists.tmdbId, movies.tmdbId))
      .where(
        and(
          eq(userMovieLists.userId, user.id),
          eq(userMovieLists.status, MOVIE_STATUS.WANT_TO_WATCH),
          lt(userMovieLists.createdAt, weekAgo)
        )
      )
      .orderBy(desc(userMovieLists.createdAt))
      .limit(3);

    // Create prompts for these movies
    for (const candidate of candidates) {
      // Check if prompt already exists
      const [existing] = await db
        .select()
        .from(watchPrompts)
        .where(
          and(
            eq(watchPrompts.userId, user.id),
            eq(watchPrompts.tmdbId, candidate.list.tmdbId)
          )
        );

      if (!existing) {
        await db.insert(watchPrompts).values({
          userId: user.id,
          tmdbId: candidate.list.tmdbId,
        });
      }
    }

    // Re-fetch prompts
    const newPrompts = await db
      .select({
        prompt: watchPrompts,
        movie: movies,
      })
      .from(watchPrompts)
      .leftJoin(movies, eq(watchPrompts.tmdbId, movies.tmdbId))
      .where(
        and(
          eq(watchPrompts.userId, user.id),
          isNull(watchPrompts.respondedAt),
          or(isNull(watchPrompts.snoozeUntil), lt(watchPrompts.snoozeUntil, now))
        )
      )
      .orderBy(desc(watchPrompts.promptedAt))
      .limit(5);

    return success({
      prompts: newPrompts.map(formatPrompt),
    });
  }

  return success({
    prompts: prompts.map(formatPrompt),
  });
}

function formatPrompt(item: { prompt: typeof watchPrompts.$inferSelect; movie: Movie | null }) {
  return {
    id: item.prompt.id,
    tmdbId: item.prompt.tmdbId,
    promptedAt: item.prompt.promptedAt.toISOString(),
    movie: item.movie
      ? {
          title: item.movie.title,
          titleRu: item.movie.titleRu,
          posterPath: item.movie.posterPath,
          posterUrl: item.movie.posterUrl,
          localPosterPath: item.movie.localPosterPath,
          releaseDate: item.movie.releaseDate,
        }
      : null,
  };
}
