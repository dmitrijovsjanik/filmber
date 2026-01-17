import { Bot, Context, InlineKeyboard, webhookCallback } from 'grammy';
import { db } from '../../src/lib/db';
import {
  users,
  userMovieLists,
  watchPrompts,
  movies,
  bugReports,
  notificationSettings,
  upcomingMovies,
  MOVIE_STATUS,
  MOVIE_SOURCE,
} from '../../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { tmdb } from '../../src/lib/api/tmdb';

// Types
export type BotContext = Context;

// Environment config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// State for users awaiting bug report input
const awaitingBugReport = new Set<number>();

// Singleton bot instance
let botInstance: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!botInstance) {
    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }
    botInstance = createBot(BOT_TOKEN);
  }
  return botInstance;
}

function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // /start command - opens the Mini App
  bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      ctx.from?.language_code === 'ru' ? 'Открыть Filmber' : 'Open Filmber',
      `${WEBAPP_URL}/telegram`
    );

    const welcomeMessage =
      ctx.from?.language_code === 'ru'
        ? `Привет, ${ctx.from?.first_name || 'друг'}! 🎬\n\nFilmber поможет тебе найти идеальный фильм для просмотра.\n\nНажми кнопку ниже, чтобы начать!`
        : `Hi, ${ctx.from?.first_name || 'there'}! 🎬\n\nFilmber helps you find the perfect movie to watch.\n\nTap the button below to get started!`;

    await ctx.reply(welcomeMessage, { reply_markup: keyboard });
  });

  // /help command
  bot.command('help', async (ctx) => {
    const isRussian = ctx.from?.language_code === 'ru';

    const helpText = isRussian
      ? `📖 *Помощь по Filmber*

/start - Открыть приложение для подбора фильмов
/help - Показать эту справку
/bug - Сообщить об ошибке

*Как это работает:*
1. Открой Mini App через кнопку
2. Свайпай фильмы: вправо - нравится, влево - пропустить
3. Сохраняй понравившиеся фильмы в списки
4. Смотри с друзьями - находите фильмы которые нравятся обоим!

Для полного опыта используй Mini App!`
      : `📖 *Filmber Help*

/start - Open the movie matching app
/help - Show this help message
/bug - Report an issue

*How it works:*
1. Open the Mini App via the button
2. Swipe movies: right - like, left - skip
3. Save liked movies to your lists
4. Watch with friends - find movies you both like!

For the full experience, use the Mini App!`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  // /admin command - opens admin panel (only for admins)
  bot.command('admin', async (ctx) => {
    const telegramId = ctx.from?.id;
    const isRussian = ctx.from?.language_code === 'ru';

    // Check if user is admin
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => parseInt(id.trim(), 10)) || [];

    if (!telegramId || !adminIds.includes(telegramId)) {
      await ctx.reply(
        isRussian
          ? '⛔ У вас нет доступа к админ-панели.'
          : '⛔ You do not have access to the admin panel.'
      );
      return;
    }

    const keyboard = new InlineKeyboard().webApp(
      isRussian ? '🔧 Открыть админку' : '🔧 Open Admin Panel',
      `${WEBAPP_URL}/admin`
    );

    await ctx.reply(
      isRussian
        ? '🔧 Нажмите кнопку ниже, чтобы открыть админ-панель:'
        : '🔧 Tap the button below to open the admin panel:',
      { reply_markup: keyboard }
    );
  });

  // /bug command - report an issue
  bot.command('bug', async (ctx) => {
    const isRussian = ctx.from?.language_code === 'ru';
    const telegramId = ctx.from?.id;

    if (telegramId) {
      awaitingBugReport.add(telegramId);
    }

    await ctx.reply(
      isRussian
        ? '🐛 Опишите проблему, с которой вы столкнулись:'
        : '🐛 Please describe the issue you encountered:'
    );
  });

  // Handle text messages (for bug reports)
  bot.on('message:text', async (ctx) => {
    const telegramId = ctx.from?.id;

    if (telegramId && awaitingBugReport.has(telegramId)) {
      awaitingBugReport.delete(telegramId);

      const isRussian = ctx.from?.language_code === 'ru';

      try {
        // Find user in database (optional - report can be from non-registered user)
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.telegramId, telegramId));

        // Save bug report to database
        await db.insert(bugReports).values({
          userId: user?.id || null,
          telegramId,
          telegramUsername: ctx.from?.username || null,
          firstName: ctx.from?.first_name || null,
          message: ctx.message.text,
          status: 'open',
        });

        // Also send to admin via Telegram (for immediate notification)
        if (ADMIN_TELEGRAM_ID) {
          const reportMessage = `🐛 Bug Report\n\nFrom: ${ctx.from?.first_name} (@${ctx.from?.username || 'no username'})\nID: ${telegramId}\n\n${ctx.message.text}`;

          try {
            await ctx.api.sendMessage(ADMIN_TELEGRAM_ID, reportMessage);
          } catch (error) {
            console.error('Failed to send bug report to admin:', error);
          }
        }

        await ctx.reply(
          isRussian
            ? '✅ Спасибо! Ваше сообщение отправлено разработчику.'
            : '✅ Thank you! Your message has been sent to the developer.'
        );
      } catch (error) {
        console.error('Failed to save bug report:', error);
        await ctx.reply(
          isRussian
            ? '❌ Произошла ошибка. Попробуйте позже.'
            : '❌ An error occurred. Please try again later.'
        );
      }
    }
  });

  // Callback query: User clicked "Yes, watched!"
  bot.callbackQuery(/^watched:(\d+)$/, async (ctx) => {
    const tmdbId = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    const isRussian = ctx.from.language_code === 'ru';

    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId));

      if (!user) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Пользователь не найден' : 'User not found',
        });
        return;
      }

      // Show rating buttons
      const keyboard = new InlineKeyboard()
        .text('😐', `rate:${tmdbId}:1`)
        .text('🙂', `rate:${tmdbId}:2`)
        .text('🤩', `rate:${tmdbId}:3`);

      const ratingMessage = isRussian
        ? 'Как вам фильм? Выберите оценку:'
        : 'How was the movie? Rate it:';

      await ctx.editMessageText(ratingMessage, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Error handling watched callback:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
      });
    }
  });

  // Callback query: User selected a rating
  bot.callbackQuery(/^rate:(\d+):(\d)$/, async (ctx) => {
    const tmdbId = parseInt(ctx.match[1], 10);
    const rating = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;
    const isRussian = ctx.from.language_code === 'ru';

    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId));

      if (!user) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Пользователь не найден' : 'User not found',
        });
        return;
      }

      // Look up movie to get unifiedMovieId
      const [movie] = await db
        .select()
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));

      if (!movie) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Фильм не найден' : 'Movie not found',
        });
        return;
      }

      // Update movie status and rating
      await db
        .update(userMovieLists)
        .set({
          status: MOVIE_STATUS.WATCHED,
          rating,
          watchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userMovieLists.userId, user.id),
            eq(userMovieLists.unifiedMovieId, movie.id)
          )
        );

      // Mark prompt as responded
      await db
        .update(watchPrompts)
        .set({
          respondedAt: new Date(),
          response: 'watched',
        })
        .where(
          and(
            eq(watchPrompts.userId, user.id),
            eq(watchPrompts.unifiedMovieId, movie.id)
          )
        );

      // Get movie title for confirmation (already have movie from above)
      const movieTitle =
        isRussian && movie.titleRu
          ? movie.titleRu
          : movie.title || `Movie #${tmdbId}`;

      const ratingEmoji = rating === 1 ? '😐' : rating === 2 ? '🙂' : '🤩';
      const successMessage = isRussian
        ? `🎬 Надеюсь, вы хорошо провели время за просмотром «${movieTitle}»!\n\nОтметил оценкой ${ratingEmoji}`
        : `🎬 Hope you had a great time watching "${movieTitle}"!\n\nMarked with rating ${ratingEmoji}`;

      await ctx.editMessageText(successMessage);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Сохранено!' : 'Saved!',
      });
    } catch (error) {
      console.error('Error handling rate callback:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
      });
    }
  });

  // Callback query: User clicked "Not yet"
  bot.callbackQuery(/^not_yet:(\d+)$/, async (ctx) => {
    const tmdbId = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    const isRussian = ctx.from.language_code === 'ru';

    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId));

      if (!user) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Пользователь не найден' : 'User not found',
        });
        return;
      }

      // Look up movie to get unifiedMovieId
      const [movie] = await db
        .select()
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));

      if (!movie) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Фильм не найден' : 'Movie not found',
        });
        return;
      }

      // Update movie status back to want_to_watch and clear watchStartedAt
      await db
        .update(userMovieLists)
        .set({
          status: MOVIE_STATUS.WANT_TO_WATCH,
          watchStartedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userMovieLists.userId, user.id),
            eq(userMovieLists.unifiedMovieId, movie.id)
          )
        );

      // Mark prompt as responded
      await db
        .update(watchPrompts)
        .set({
          respondedAt: new Date(),
          response: 'not_yet',
        })
        .where(
          and(
            eq(watchPrompts.userId, user.id),
            eq(watchPrompts.unifiedMovieId, movie.id)
          )
        );

      // Get movie title for message (already have movie from above)
      const movieTitle =
        isRussian && movie.titleRu
          ? movie.titleRu
          : movie.title || `Movie #${tmdbId}`;

      const notYetMessage = isRussian
        ? `😔 Как жаль, что не удалось посмотреть «${movieTitle}».\n\nОставил в списке «Хочу посмотреть».`
        : `😔 Too bad you didn't get to watch "${movieTitle}".\n\nKept it in your "Want to Watch" list.`;

      await ctx.editMessageText(notYetMessage);
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Error handling not_yet callback:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
      });
    }
  });

  // Callback query: Add movie to want_to_watch list (from upcoming notifications)
  bot.callbackQuery(/^addlist:(\d+)$/, async (ctx) => {
    const tmdbId = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    const isRussian = ctx.from.language_code === 'ru';

    console.log(`[addlist] tmdbId=${tmdbId}, telegramId=${telegramId}`);

    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId));

      if (!user) {
        console.log(`[addlist] User not found for telegramId=${telegramId}`);
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Пользователь не найден. Откройте приложение для регистрации.' : 'User not found. Open the app to register.',
          show_alert: true,
        });
        return;
      }

      console.log(`[addlist] Found user ${user.id}`);

      // Check if movie exists in our database
      let [movie] = await db
        .select()
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));

      // If movie not in database, fetch from TMDB and create
      if (!movie) {
        try {
          const tmdbMovie = await tmdb.getMovieDetails(tmdbId, 'en-US');
          const tmdbMovieRu = await tmdb.getMovieDetails(tmdbId, 'ru-RU');

          const [created] = await db
            .insert(movies)
            .values({
              tmdbId,
              title: tmdbMovie.title,
              titleRu: tmdbMovieRu.title || null,
              overview: tmdbMovie.overview,
              overviewRu: tmdbMovieRu.overview || null,
              posterPath: tmdbMovie.poster_path,
              backdropPath: tmdbMovie.backdrop_path,
              releaseDate: tmdbMovie.release_date,
              runtime: tmdbMovie.runtime,
              genres: JSON.stringify(tmdbMovie.genres.map((g) => g.name)),
              tmdbRating: String(tmdbMovie.vote_average),
              tmdbVoteCount: tmdbMovie.vote_count,
              imdbId: tmdbMovie.imdb_id,
              primarySource: 'tmdb',
            })
            .returning();
          movie = created;
        } catch (fetchError) {
          console.error('Failed to fetch movie from TMDB:', fetchError);
          await ctx.answerCallbackQuery({
            text: isRussian ? 'Не удалось добавить фильм' : 'Failed to add movie',
          });
          return;
        }
      }

      // Check if already in list
      const [existing] = await db
        .select()
        .from(userMovieLists)
        .where(
          and(
            eq(userMovieLists.userId, user.id),
            eq(userMovieLists.tmdbId, tmdbId)
          )
        );

      if (existing) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Уже в вашем списке!' : 'Already in your list!',
        });
        return;
      }

      // Add to want_to_watch
      console.log(`[addlist] Adding movie ${tmdbId} to user ${user.id} list`);
      await db.insert(userMovieLists).values({
        userId: user.id,
        tmdbId,
        unifiedMovieId: movie.id,
        status: MOVIE_STATUS.WANT_TO_WATCH,
        source: MOVIE_SOURCE.MANUAL,
      });

      console.log(`[addlist] Successfully added movie ${tmdbId} to list`);
      await ctx.answerCallbackQuery({
        text: isRussian ? '✅ Добавлено в «Хочу посмотреть»!' : '✅ Added to "Want to Watch"!',
        show_alert: true,
      });
    } catch (error) {
      console.error('[addlist] Error handling addlist callback:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
        show_alert: true,
      });
    }
  });

  // Callback query: Toggle notification settings - show confirmation dialog
  bot.callbackQuery(/^toggle:(announcements|releases|digital|updates)$/, async (ctx) => {
    const settingType = ctx.match[1];
    const isRussian = ctx.from.language_code === 'ru';

    const settingName = {
      announcements: isRussian ? 'анонсы фильмов' : 'movie announcements',
      releases: isRussian ? 'премьеры в кино' : 'theatrical releases',
      digital: isRussian ? 'цифровые релизы' : 'digital releases',
      updates: isRussian ? 'обновления приложения' : 'app updates',
    }[settingType];

    const keyboard = new InlineKeyboard()
      .text(isRussian ? '✅ Да, отключить' : '✅ Yes, disable', `confirm_toggle:${settingType}`)
      .text(isRussian ? '❌ Нет, оставить' : '❌ No, keep', 'cancel_toggle');

    const confirmText = isRussian
      ? `🔕 Отключить уведомления о <b>${settingName}</b>?\n\nВключить обратно можно на странице профиля в разделе «Уведомления».`
      : `🔕 Disable <b>${settingName}</b> notifications?\n\nYou can re-enable them in your profile under "Notifications".`;

    try {
      await ctx.reply(confirmText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Error showing confirmation dialog:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
      });
    }
  });

  // Callback query: Confirm toggle - actually disable the setting
  bot.callbackQuery(/^confirm_toggle:(announcements|releases|digital|updates)$/, async (ctx) => {
    const settingType = ctx.match[1];
    const telegramId = ctx.from.id;
    const isRussian = ctx.from.language_code === 'ru';

    try {
      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId));

      if (!user) {
        await ctx.answerCallbackQuery({
          text: isRussian ? 'Пользователь не найден' : 'User not found',
        });
        return;
      }

      // Map setting type to column
      const settingColumn = {
        announcements: 'upcomingAnnouncements',
        releases: 'upcomingTheatricalReleases',
        digital: 'upcomingDigitalReleases',
        updates: 'appUpdates',
      }[settingType] as 'upcomingAnnouncements' | 'upcomingTheatricalReleases' | 'upcomingDigitalReleases' | 'appUpdates';

      // Get current settings
      const [settings] = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, user.id));

      // Disable the setting
      if (settings) {
        await db
          .update(notificationSettings)
          .set({
            [settingColumn]: false,
            updatedAt: new Date(),
          })
          .where(eq(notificationSettings.userId, user.id));
      } else {
        await db.insert(notificationSettings).values({
          userId: user.id,
          [settingColumn]: false,
        });
      }

      const settingName = {
        announcements: isRussian ? 'анонсы' : 'announcements',
        releases: isRussian ? 'премьеры' : 'releases',
        digital: isRussian ? 'цифровые релизы' : 'digital releases',
        updates: isRussian ? 'обновления' : 'app updates',
      }[settingType];

      // Delete the confirmation message
      await ctx.deleteMessage();

      await ctx.answerCallbackQuery({
        text: isRussian ? `🔕 Уведомления о ${settingName} отключены` : `🔕 ${settingName} notifications disabled`,
      });
    } catch (error) {
      console.error('Error handling confirm toggle callback:', error);
      await ctx.answerCallbackQuery({
        text: isRussian ? 'Произошла ошибка' : 'An error occurred',
      });
    }
  });

  // Callback query: Cancel toggle - just delete the confirmation message
  bot.callbackQuery('cancel_toggle', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Error handling cancel toggle callback:', error);
      await ctx.answerCallbackQuery();
    }
  });

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}

// Webhook handler for production (used by API route)
export function createWebhookHandler() {
  const bot = getBot();
  return webhookCallback(bot, 'std/http', {
    secretToken: WEBHOOK_SECRET,
  });
}

// Start polling (for development)
export async function startPolling(): Promise<void> {
  const bot = getBot();

  // Delete any existing webhook before starting polling (non-blocking)
  try {
    await bot.api.deleteWebhook();
  } catch (err) {
    console.warn('> Failed to delete webhook:', (err as Error).message);
  }

  await bot.start({
    onStart: () => {
      console.log('> Telegram bot started (polling mode)');
    },
  });
}

// Set webhook (for production)
export async function setWebhook(url: string): Promise<void> {
  const bot = getBot();
  await bot.api.setWebhook(url, {
    secret_token: WEBHOOK_SECRET,
  });
  console.log(`> Telegram webhook set to ${url}`);

  // Set bot menu commands (non-blocking - don't fail if rate limited)
  bot.api
    .setMyCommands([
      { command: 'start', description: 'Открыть Filmber / Open Filmber' },
      { command: 'help', description: 'Помощь / Help' },
      { command: 'bug', description: 'Сообщить об ошибке / Report a bug' },
    ])
    .then(() => {
      console.log('> Telegram bot commands set');
    })
    .catch((err) => {
      console.warn('> Failed to set bot commands (will retry on next deploy):', err.message);
    });
}

// Stop the bot gracefully
export async function stopBot(): Promise<void> {
  if (botInstance) {
    await botInstance.stop();
    botInstance = null;
  }
}
