import { InlineKeyboard } from 'grammy';
import type { UpcomingMovie } from '@/lib/db/schema';
import { formatReleaseDate } from '@/lib/api/release-dates';

export interface NotificationMessage {
  text: string;
  photoUrl?: string;
  keyboard?: InlineKeyboard;
}

// Minimal movie data interface for notifications
export interface MovieNotificationData {
  title: string;
  titleRu?: string | null;
  posterPath?: string | null;
  releaseDate?: string | Date | null;
  overview?: string | null;
  overviewRu?: string | null;
  tmdbId: number;
  theatricalReleaseRu?: Date | null;
  theatricalReleaseUs?: Date | null;
}

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

/**
 * Get Mini App URL for movie details
 */
function getMovieAppUrl(tmdbId: number): string {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';
  const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app';
  return `https://t.me/${botUsername}/${miniAppName}?startapp=movie_${tmdbId}`;
}

/**
 * Format announcement notification message
 */
export function formatAnnouncementMessage(
  movie: UpcomingMovie | MovieNotificationData,
  isRussian: boolean
): NotificationMessage {
  const title = isRussian && movie.titleRu ? movie.titleRu : movie.title;
  const overview = isRussian && 'overviewRu' in movie && movie.overviewRu ? movie.overviewRu : movie.overview;

  // Get release date - support both UpcomingMovie and simplified format
  let releaseDate: Date | string | null = null;
  if ('theatricalReleaseRu' in movie && movie.theatricalReleaseRu) {
    releaseDate = isRussian ? movie.theatricalReleaseRu : (movie.theatricalReleaseUs || movie.theatricalReleaseRu);
  } else if ('theatricalReleaseUs' in movie && movie.theatricalReleaseUs) {
    releaseDate = movie.theatricalReleaseUs;
  } else if ('releaseDate' in movie && movie.releaseDate) {
    releaseDate = movie.releaseDate;
  }

  const formattedDate = formatReleaseDate(releaseDate, isRussian ? 'ru' : 'en');

  const text = isRussian
    ? `🎬 <b>Новый анонс!</b>\n\n<b>${escapeHtml(title)}</b>\n\n📅 Премьера: ${formattedDate}\n\n${truncateText(escapeHtml(overview || ''), 800)}`
    : `🎬 <b>New Announcement!</b>\n\n<b>${escapeHtml(title)}</b>\n\n📅 Release: ${formattedDate}\n\n${truncateText(escapeHtml(overview || ''), 800)}`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Подробнее' : '🎬 Details', getMovieAppUrl(movie.tmdbId))
    .text(isRussian ? '📋 В список' : '📋 Add to list', `addlist:${movie.tmdbId}`)
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:announcements');

  return {
    text,
    photoUrl: movie.posterPath ? `${POSTER_BASE_URL}${movie.posterPath}` : undefined,
    keyboard,
  };
}

/**
 * Format theatrical release notification message
 */
export function formatTheatricalReleaseMessage(
  movie: UpcomingMovie | MovieNotificationData,
  isRussian: boolean
): NotificationMessage {
  const title = isRussian && movie.titleRu ? movie.titleRu : movie.title;

  const text = isRussian
    ? `🎥 <b>Сегодня в кино!</b>\n\n<b>${escapeHtml(title)}</b>\n\nФильм вышел в прокат. Приятного просмотра!`
    : `🎥 <b>Now in Theaters!</b>\n\n<b>${escapeHtml(title)}</b>\n\nThis movie is now playing in theaters. Enjoy!`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Подробнее' : '🎬 Details', getMovieAppUrl(movie.tmdbId))
    .text(isRussian ? '📋 В список' : '📋 Add to list', `addlist:${movie.tmdbId}`)
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:releases');

  return {
    text,
    photoUrl: movie.posterPath ? `${POSTER_BASE_URL}${movie.posterPath}` : undefined,
    keyboard,
  };
}

/**
 * Format digital release notification message
 */
export function formatDigitalReleaseMessage(
  movie: UpcomingMovie | MovieNotificationData,
  isRussian: boolean
): NotificationMessage {
  const title = isRussian && movie.titleRu ? movie.titleRu : movie.title;

  const text = isRussian
    ? `📺 <b>Доступен в цифре!</b>\n\n<b>${escapeHtml(title)}</b>\n\nФильм теперь доступен для онлайн-просмотра. Дубляж уже должен быть готов!`
    : `📺 <b>Now Available Digitally!</b>\n\n<b>${escapeHtml(title)}</b>\n\nThis movie is now available for streaming online.`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Подробнее' : '🎬 Details', getMovieAppUrl(movie.tmdbId))
    .text(isRussian ? '📋 В список' : '📋 Add to list', `addlist:${movie.tmdbId}`)
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:digital');

  return {
    text,
    photoUrl: movie.posterPath ? `${POSTER_BASE_URL}${movie.posterPath}` : undefined,
    keyboard,
  };
}

/**
 * Format release notes / app update notification message
 */
export function formatReleaseNotesMessage(
  version: string,
  releaseNotes: string,
  isRussian: boolean
): NotificationMessage {
  const text = isRussian
    ? `🚀 <b>Обновление Filmber v${escapeHtml(version)}</b>\n\n${escapeHtml(releaseNotes)}`
    : `🚀 <b>Filmber Update v${escapeHtml(version)}</b>\n\n${escapeHtml(releaseNotes)}`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Открыть' : '🎬 Open App', getMovieAppUrl(0).replace('?startapp=movie_0', ''))
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:updates');

  return {
    text,
    keyboard,
  };
}

// ============================================
// TV SERIES NOTIFICATION FORMATTERS
// ============================================

export interface SeriesNotificationData {
  title: string;
  titleRu?: string | null;
  posterPath?: string | null;
  tmdbId: number;
  seasonNumber: number;
  episodeNumber?: number;
  episodeName?: string | null;
}

/**
 * Format season announcement notification message
 */
export function formatSeasonAnnouncementMessage(
  series: SeriesNotificationData,
  isRussian: boolean
): NotificationMessage {
  const title = isRussian && series.titleRu ? series.titleRu : series.title;

  const text = isRussian
    ? `📺 <b>Новый сезон!</b>\n\n<b>${escapeHtml(title)}</b>\n\nСезон ${series.seasonNumber} уже доступен! Сериал перемещён в "Хочу посмотреть".`
    : `📺 <b>New Season!</b>\n\n<b>${escapeHtml(title)}</b>\n\nSeason ${series.seasonNumber} is now available! The series has been moved to your watchlist.`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Подробнее' : '🎬 Details', getMovieAppUrl(series.tmdbId))
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:series_seasons');

  return {
    text,
    photoUrl: series.posterPath ? `${POSTER_BASE_URL}${series.posterPath}` : undefined,
    keyboard,
  };
}

/**
 * Format episode release notification message
 */
export function formatEpisodeReleaseMessage(
  series: SeriesNotificationData,
  isRussian: boolean
): NotificationMessage {
  const title = isRussian && series.titleRu ? series.titleRu : series.title;
  const epLabel = `S${series.seasonNumber}E${series.episodeNumber}${series.episodeName ? ': ' + series.episodeName : ''}`;

  const text = isRussian
    ? `🎬 <b>Новая серия!</b>\n\n<b>${escapeHtml(title)}</b>\n${escapeHtml(epLabel)}\n\nДубляж должен быть уже готов!`
    : `🎬 <b>New Episode!</b>\n\n<b>${escapeHtml(title)}</b>\n${escapeHtml(epLabel)}\n\nNow available for streaming!`;

  const keyboard = new InlineKeyboard()
    .url(isRussian ? '🎬 Подробнее' : '🎬 Details', getMovieAppUrl(series.tmdbId))
    .row()
    .text(isRussian ? '🔕 Отписаться' : '🔕 Unsubscribe', 'toggle:series_episodes');

  return {
    text,
    photoUrl: series.posterPath ? `${POSTER_BASE_URL}${series.posterPath}` : undefined,
    keyboard,
  };
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Default message templates (can be overridden by admin config)
 */
export const DEFAULT_TEMPLATES = {
  announcement: {
    en: '🎬 <b>New Announcement!</b>\n\n<b>{title}</b>\n\n📅 Release: {releaseDate}\n\n{overview}',
    ru: '🎬 <b>Новый анонс!</b>\n\n<b>{title}</b>\n\n📅 Премьера: {releaseDate}\n\n{overview}',
  },
  theatrical: {
    en: '🎥 <b>Now in Theaters!</b>\n\n<b>{title}</b>\n\nThis movie is now playing in theaters. Enjoy!',
    ru: '🎥 <b>Сегодня в кино!</b>\n\n<b>{title}</b>\n\nФильм вышел в прокат. Приятного просмотра!',
  },
  digital: {
    en: '📺 <b>Now Available Digitally!</b>\n\n<b>{title}</b>\n\nThis movie is now available for streaming online.',
    ru: '📺 <b>Доступен в цифре!</b>\n\n<b>{title}</b>\n\nФильм теперь доступен для онлайн-просмотра.',
  },
};
