import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  upcomingMovies,
  users,
  notificationSettings,
  notificationLog,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, or, and, lte } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { formatTheatricalReleaseMessage } from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;

export async function GET(request: NextRequest) {
  return handleSendReleases(request);
}

export async function POST(request: NextRequest) {
  return handleSendReleases(request);
}

async function handleSendReleases(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      moviesProcessed: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
    };

    const today = new Date().toISOString().split('T')[0];

    // Get movies releasing today (US or RU) that haven't been notified
    const moviesToNotify = await db
      .select()
      .from(upcomingMovies)
      .where(
        and(
          eq(upcomingMovies.status, 'tracked'),
          isNull(upcomingMovies.theatricalReleaseSentAt),
          or(
            eq(upcomingMovies.theatricalReleaseUs, today),
            eq(upcomingMovies.theatricalReleaseRu, today),
            // Also notify for past releases that were missed
            and(
              lte(upcomingMovies.theatricalReleaseUs, today),
              isNull(upcomingMovies.theatricalReleaseSentAt)
            )
          )
        )
      )
      .limit(10);

    if (moviesToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No releases to notify',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    // Get users who have theatrical releases enabled
    const targetUsers = await db
      .select({
        id: users.id,
        telegramId: users.telegramId,
        languageCode: users.languageCode,
      })
      .from(users)
      .leftJoin(notificationSettings, eq(users.id, notificationSettings.userId))
      .where(
        or(
          isNull(notificationSettings.upcomingTheatricalReleases),
          eq(notificationSettings.upcomingTheatricalReleases, true)
        )
      );

    if (targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with theatrical releases enabled',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    const bot = getBot();

    for (const movie of moviesToNotify) {
      results.moviesProcessed++;

      // Create log entry
      const [logEntry] = await db
        .insert(notificationLog)
        .values({
          type: NOTIFICATION_TYPE.THEATRICAL_RELEASE,
          upcomingMovieId: movie.id,
          tmdbId: movie.tmdbId,
          totalRecipients: targetUsers.length,
        })
        .returning();

      let successCount = 0;
      let failureCount = 0;

      // Send in batches
      for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
        const batch = targetUsers.slice(i, i + BATCH_SIZE);

        const sendPromises = batch.map(async (user) => {
          try {
            const isRussian = user.languageCode === 'ru';
            const message = formatTheatricalReleaseMessage(movie, isRussian);

            if (message.photoUrl) {
              await bot.api.sendPhoto(user.telegramId, message.photoUrl, {
                caption: message.text,
                parse_mode: 'HTML',
                reply_markup: message.keyboard,
              });
            } else {
              await bot.api.sendMessage(user.telegramId, message.text, {
                parse_mode: 'HTML',
                reply_markup: message.keyboard,
              });
            }
            return { success: true };
          } catch {
            return { success: false };
          }
        });

        const batchResults = await Promise.all(sendPromises);

        for (const result of batchResults) {
          if (result.success) {
            successCount++;
            results.notificationsSent++;
          } else {
            failureCount++;
            results.notificationsFailed++;
          }
        }

        if (i + BATCH_SIZE < targetUsers.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // Update log entry
      await db
        .update(notificationLog)
        .set({
          successCount,
          failureCount,
          completedAt: new Date(),
        })
        .where(eq(notificationLog.id, logEntry.id));

      // Mark movie as notified and update status to released
      await db
        .update(upcomingMovies)
        .set({
          theatricalReleaseSentAt: new Date(),
          status: 'released',
          updatedAt: new Date(),
        })
        .where(eq(upcomingMovies.id, movie.id));
    }

    return NextResponse.json({
      success: true,
      message: 'Release notifications sent',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send releases cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send release notifications', details: String(error) },
      { status: 500 }
    );
  }
}
