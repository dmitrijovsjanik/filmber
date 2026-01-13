import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  userMovieLists,
  users,
  movies,
  watchPrompts,
  notificationSettings,
  MOVIE_STATUS,
} from '@/lib/db/schema';
import { eq, and, isNull, or, isNotNull } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { InlineKeyboard } from 'grammy';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Buffer time after movie ends before sending reminder (5 minutes in ms)
const BUFFER_AFTER_MOVIE_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find movies with 'watching' status
    // We need to check if: now > watchStartedAt + runtime + 5 minutes
    const watchingMovies = await db
      .select({
        listId: userMovieLists.id,
        userId: userMovieLists.userId,
        tmdbId: userMovieLists.tmdbId,
        watchStartedAt: userMovieLists.watchStartedAt,
        user: {
          telegramId: users.telegramId,
          firstName: users.firstName,
          languageCode: users.languageCode,
        },
        movie: {
          title: movies.title,
          titleRu: movies.titleRu,
          runtime: movies.runtime,
        },
      })
      .from(userMovieLists)
      .innerJoin(users, eq(userMovieLists.userId, users.id))
      .leftJoin(movies, eq(userMovieLists.tmdbId, movies.tmdbId))
      .leftJoin(
        notificationSettings,
        eq(users.id, notificationSettings.userId)
      )
      .where(
        and(
          eq(userMovieLists.status, MOVIE_STATUS.WATCHING),
          isNotNull(userMovieLists.watchStartedAt),
          // Check notification settings (default true if no settings)
          or(
            isNull(notificationSettings.watchReminders),
            eq(notificationSettings.watchReminders, true)
          )
        )
      );

    // Filter movies where: now > watchStartedAt + runtime + 5 min buffer
    const moviesNeedingReminder = watchingMovies.filter((item) => {
      if (!item.watchStartedAt) return false;

      // Get runtime from movies table (default 2 hours)
      const runtime = item.movie?.runtime || 120;
      const watchEndTime = new Date(item.watchStartedAt.getTime() + runtime * 60 * 1000);
      const reminderTime = new Date(watchEndTime.getTime() + BUFFER_AFTER_MOVIE_MS);

      return now >= reminderTime;
    });

    // Filter out movies that already have pending prompts (not responded yet)
    // or have been snoozed (snoozeUntil > now)
    const existingPrompts = await db
      .select({
        tmdbId: watchPrompts.tmdbId,
        userId: watchPrompts.userId,
        respondedAt: watchPrompts.respondedAt,
        snoozeUntil: watchPrompts.snoozeUntil,
      })
      .from(watchPrompts);

    const moviesToNotify = moviesNeedingReminder.filter((m) => {
      const prompt = existingPrompts.find(
        (p) => p.userId === m.userId && p.tmdbId === m.tmdbId
      );

      if (!prompt) {
        // No prompt exists - should notify
        return true;
      }

      if (!prompt.respondedAt) {
        // Prompt exists but not responded - don't send another
        return false;
      }

      if (prompt.snoozeUntil && prompt.snoozeUntil > now) {
        // User said "not yet" and snooze is still active
        return false;
      }

      // User said "not yet" and snooze has expired - send reminder again
      if (prompt.snoozeUntil && prompt.snoozeUntil <= now) {
        return true;
      }

      // Already responded with watched/dismissed
      return false;
    });

    if (moviesToNotify.length === 0) {
      return NextResponse.json({ message: 'No reminders to send', count: 0 });
    }

    const bot = getBot();
    let sentCount = 0;
    const errors: string[] = [];

    for (const item of moviesToNotify) {
      try {
        const isRussian = item.user.languageCode === 'ru';
        const movieTitle =
          isRussian && item.movie?.titleRu
            ? item.movie.titleRu
            : item.movie?.title || `Movie #${item.tmdbId}`;

        const message = isRussian
          ? `🎬 Привет, ${item.user.firstName}!\n\nВы добавили «${movieTitle}» в список.\nУдалось посмотреть?`
          : `🎬 Hi, ${item.user.firstName}!\n\nYou added "${movieTitle}" to your list.\nDid you get a chance to watch it?`;

        const keyboard = new InlineKeyboard()
          .text(isRussian ? '✅ Да, посмотрел!' : '✅ Yes, watched!', `watched:${item.tmdbId}`)
          .text(isRussian ? '⏳ Ещё нет' : '⏳ Not yet', `not_yet:${item.tmdbId}`);

        await bot.api.sendMessage(item.user.telegramId, message, {
          reply_markup: keyboard,
        });

        // Create or update prompt record
        const existingPrompt = existingPrompts.find(
          (p) => p.userId === item.userId && p.tmdbId === item.tmdbId
        );

        if (existingPrompt) {
          // Update existing prompt (re-send after snooze expired)
          await db
            .update(watchPrompts)
            .set({
              promptedAt: now,
              respondedAt: null,
              response: null,
              snoozeUntil: null,
            })
            .where(
              and(
                eq(watchPrompts.userId, item.userId),
                eq(watchPrompts.tmdbId, item.tmdbId)
              )
            );
        } else {
          // Create new prompt
          await db.insert(watchPrompts).values({
            userId: item.userId,
            tmdbId: item.tmdbId,
            promptedAt: now,
          });
        }

        sentCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${item.user.telegramId}: ${errorMsg}`);
        console.error(`Failed to send reminder to ${item.user.telegramId}:`, error);
      }
    }

    return NextResponse.json({
      message: 'Reminders processed',
      sent: sentCount,
      total: moviesToNotify.length,
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
