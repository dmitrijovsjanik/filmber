import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { upcomingMovies, users } from '@/lib/db/schema';
import { withAdmin } from '@/lib/auth/admin';
import { success, badRequest, notFound } from '@/lib/auth/middleware';
import { eq } from 'drizzle-orm';
import { getBot } from '../../../../../../server/bot';
import {
  formatAnnouncementMessage,
  formatTheatricalReleaseMessage,
  formatDigitalReleaseMessage,
  formatReleaseNotesMessage,
} from '../../../../../../server/bot/notifications';
import { tmdb } from '@/lib/api/tmdb';
import type { User } from '@/lib/db/schema';

// POST /api/admin/notifications/test - Send test notification
export const POST = withAdmin(async (request: NextRequest, adminUser: User) => {
  try {
    const body = await request.json();
    const { type, tmdbId, userId, version, releaseNotes } = body;

    if (!type || !['announcement', 'theatrical', 'digital', 'release_notes'].includes(type)) {
      return badRequest('Invalid notification type');
    }

    // For release_notes, we need version and releaseNotes instead of tmdbId
    if (type === 'release_notes') {
      if (!version || !releaseNotes) {
        return badRequest('Missing version or releaseNotes for release_notes type');
      }
    } else if (!tmdbId || typeof tmdbId !== 'number') {
      return badRequest('Missing or invalid tmdbId');
    }

    // Get movie data (only for movie notification types)
    let movieData: {
      title: string;
      titleRu: string | null;
      posterPath: string | null;
      releaseDate: string | null;
      overview: string | null;
      overviewRu: string | null;
      tmdbId: number;
    } | null = null;

    if (type !== 'release_notes') {
      // Get the movie from upcoming_movies first, fallback to TMDB
      const [movie] = await db
        .select()
        .from(upcomingMovies)
        .where(eq(upcomingMovies.tmdbId, tmdbId));

      if (movie) {
        movieData = {
          title: movie.title,
          titleRu: movie.titleRu,
          posterPath: movie.posterPath,
          releaseDate: movie.theatricalReleaseUs || movie.theatricalReleaseRu || null,
          overview: movie.overview,
          overviewRu: movie.overviewRu,
          tmdbId: movie.tmdbId,
        };
      } else {
        // Fetch from TMDB in both languages
        const [tmdbMovieEn, tmdbMovieRu] = await Promise.all([
          tmdb.getMovieDetails(tmdbId, 'en-US'),
          tmdb.getMovieDetails(tmdbId, 'ru-RU'),
        ]);

        if (!tmdbMovieEn) {
          return notFound('Movie not found');
        }

        movieData = {
          title: tmdbMovieEn.original_title || tmdbMovieEn.title,
          titleRu: tmdbMovieRu?.title || null,
          posterPath: tmdbMovieEn.poster_path,
          releaseDate: tmdbMovieEn.release_date || null,
          overview: tmdbMovieEn.overview || null,
          overviewRu: tmdbMovieRu?.overview || null,
          tmdbId,
        };
      }
    }

    // Get target user (either specified userId or admin)
    let targetUser: typeof adminUser;
    if (userId) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      if (!foundUser) {
        return notFound('User not found');
      }
      targetUser = foundUser;
    } else {
      targetUser = adminUser;
    }

    if (!targetUser?.telegramId) {
      return badRequest('Target user does not have a Telegram ID');
    }

    // Format message based on type
    const isRussian = targetUser.languageCode === 'ru';
    let message;

    switch (type) {
      case 'announcement':
        if (!movieData) return badRequest('Movie data required');
        message = formatAnnouncementMessage(movieData, isRussian);
        break;
      case 'theatrical':
        if (!movieData) return badRequest('Movie data required');
        message = formatTheatricalReleaseMessage(movieData, isRussian);
        break;
      case 'digital':
        if (!movieData) return badRequest('Movie data required');
        message = formatDigitalReleaseMessage(movieData, isRussian);
        break;
      case 'release_notes':
        message = formatReleaseNotesMessage(version, releaseNotes, isRussian);
        break;
      default:
        return badRequest('Invalid notification type');
    }

    // Send test notification
    const bot = getBot();

    try {
      if (message.photoUrl) {
        await bot.api.sendPhoto(targetUser.telegramId, message.photoUrl, {
          caption: `[TEST] ${message.text}`,
          parse_mode: 'HTML',
          reply_markup: message.keyboard,
        });
      } else {
        await bot.api.sendMessage(targetUser.telegramId, `[TEST] ${message.text}`, {
          parse_mode: 'HTML',
          reply_markup: message.keyboard,
        });
      }
    } catch (sendError) {
      console.error('Failed to send test notification:', sendError);
      return NextResponse.json(
        { error: 'Failed to send notification', details: String(sendError) },
        { status: 500 }
      );
    }

    return success({
      data: {
        message: 'Test notification sent',
        type,
        ...(type === 'release_notes'
          ? { version }
          : { tmdbId, movieTitle: movieData?.title }),
        sentTo: targetUser.telegramUsername || targetUser.firstName,
      },
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
