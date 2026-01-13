import { Bot, Context, InlineKeyboard, webhookCallback } from 'grammy';
import { db } from '../../src/lib/db';
import {
  users,
  userMovieLists,
  watchPrompts,
  movies,
  MOVIE_STATUS,
} from '../../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Types
export interface BotContext extends Context {}

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

      // Send to admin
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
            eq(userMovieLists.tmdbId, tmdbId)
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
            eq(watchPrompts.tmdbId, tmdbId)
          )
        );

      // Get movie title for confirmation
      const [movie] = await db
        .select()
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));

      const movieTitle =
        isRussian && movie?.titleRu
          ? movie.titleRu
          : movie?.title || `Movie #${tmdbId}`;

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
            eq(userMovieLists.tmdbId, tmdbId)
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
            eq(watchPrompts.tmdbId, tmdbId)
          )
        );

      // Get movie title for message
      const [movie] = await db
        .select()
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId));

      const movieTitle =
        isRussian && movie?.titleRu
          ? movie.titleRu
          : movie?.title || `Movie #${tmdbId}`;

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

  // Delete any existing webhook before starting polling
  await bot.api.deleteWebhook();

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

  // Set bot menu commands
  await bot.api.setMyCommands([
    { command: 'start', description: 'Открыть Filmber / Open Filmber' },
    { command: 'help', description: 'Помощь / Help' },
    { command: 'bug', description: 'Сообщить об ошибке / Report a bug' },
  ]);

  console.log(`> Telegram webhook set to ${url}`);
}

// Stop the bot gracefully
export async function stopBot(): Promise<void> {
  if (botInstance) {
    await botInstance.stop();
    botInstance = null;
  }
}
