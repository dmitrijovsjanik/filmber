import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

interface SharePageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

/**
 * Smart share redirect page.
 *
 * Detects if user is coming from Telegram and redirects accordingly:
 * - Telegram app → opens Telegram Mini App via t.me deep link
 * - Web browser → opens movie page directly on website
 *
 * URL format: /share/movie/123456 or /share/tv/789
 */
export default async function SharePage({ params }: SharePageProps) {
  const { type, id } = await params;
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';

  // Validate type
  const mediaType = type.toLowerCase();
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    redirect('/');
  }

  // Validate id is numeric
  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) {
    redirect('/');
  }

  // Detect if request is from Telegram
  // Telegram's in-app browser includes "Telegram" in user agent
  const isTelegram = /telegram/i.test(userAgent);

  // Detect mobile devices (for better UX on mobile - open TG app)
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);

  if (isTelegram) {
    // User is in Telegram's in-app browser - open the mini app
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';
    const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app';
    const startAppParam = `${mediaType}_${tmdbId}`;
    const tgUrl = `https://t.me/${botUsername}/${miniAppName}?startapp=${startAppParam}`;
    redirect(tgUrl);
  }

  // Web browser - redirect to lists page with movie modal
  // Use 'ru' as default locale since most users are Russian-speaking
  const webUrl = `/ru/lists?openMovie=${tmdbId}&type=${mediaType}`;
  redirect(webUrl);
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: SharePageProps) {
  const { type, id } = await params;
  const tmdbId = parseInt(id, 10);

  if (isNaN(tmdbId)) {
    return { title: 'Filmber' };
  }

  // Fetch movie data for better meta tags
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://filmber.app';
    const mediaType = type.toLowerCase() === 'tv' ? 'tv' : 'movie';
    const response = await fetch(`${appUrl}/api/movies/${tmdbId}?type=${mediaType}`, {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const data = await response.json();
      const movie = data.movie;
      const title = movie?.titleRu || movie?.title || 'Filmber';
      const description = movie?.overviewRu || movie?.overview || 'Подбери фильм вместе с друзьями';
      const posterUrl = movie?.posterPath
        ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
        : `${appUrl}/og-image.png`;

      return {
        title: `${title} | Filmber`,
        description,
        openGraph: {
          title: `${title} | Filmber`,
          description,
          images: [posterUrl],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | Filmber`,
          description,
          images: [posterUrl],
        },
      };
    }
  } catch {
    // Ignore errors, use default metadata
  }

  return {
    title: 'Filmber - Подбери фильм вместе',
    description: 'Подбери фильм вместе с друзьями',
  };
}
