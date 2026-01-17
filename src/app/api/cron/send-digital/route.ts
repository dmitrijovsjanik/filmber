import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  upcomingMovies,
  users,
  notificationSettings,
  notificationLog,
  notificationConfig,
  NOTIFICATION_TYPE,
} from '@/lib/db/schema';
import { eq, isNull, or, and, lte } from 'drizzle-orm';
import { getBot } from '../../../../../server/bot';
import { formatDigitalReleaseMessage } from '../../../../../server/bot/notifications';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 1000;
const DEFAULT_DIGITAL_DELAY_DAYS = 7;

export async function GET(request: NextRequest) {
  return handleSendDigital(request);
}

export async function POST(request: NextRequest) {
  return handleSendDigital(request);
}

async function handleSendDigital(request: NextRequest) {
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

    // Get configured delay from admin settings
    const delayDays = await getDigitalDelayDays();

    // Calculate target date (digital release + delay days)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - delayDays);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Get movies with digital release that passed the delay period
    const moviesToNotify = await db
      .select()
      .from(upcomingMovies)
      .where(
        and(
          or(
            eq(upcomingMovies.status, 'tracked'),
            eq(upcomingMovies.status, 'released')
          ),
          isNull(upcomingMovies.digitalReleaseSentAt),
          lte(upcomingMovies.digitalRelease, targetDateStr)
        )
      )
      .limit(10);

    if (moviesToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No digital releases to notify',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    // Get users who have digital releases enabled
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
          isNull(notificationSettings.upcomingDigitalReleases),
          eq(notificationSettings.upcomingDigitalReleases, true)
        )
      );

    if (targetUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with digital releases enabled',
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
          type: NOTIFICATION_TYPE.DIGITAL_RELEASE,
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
            const message = formatDigitalReleaseMessage(movie, isRussian);

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

      // Mark movie as notified for digital
      await db
        .update(upcomingMovies)
        .set({
          digitalReleaseSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(upcomingMovies.id, movie.id));
    }

    return NextResponse.json({
      success: true,
      message: 'Digital release notifications sent',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Send digital cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send digital notifications', details: String(error) },
      { status: 500 }
    );
  }
}

async function getDigitalDelayDays(): Promise<number> {
  const [config] = await db
    .select()
    .from(notificationConfig)
    .where(eq(notificationConfig.key, 'upcoming.digitalReleaseDelayDays'));

  if (config?.value) {
    const days = parseInt(config.value, 10);
    if (!isNaN(days) && days >= 0) return days;
  }

  return DEFAULT_DIGITAL_DELAY_DAYS;
}
