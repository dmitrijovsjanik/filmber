'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { useGenres } from '@/hooks/useGenres';
import { getPosterUrl } from '@/lib/api/poster';
import { calculateAverageRatingFromStrings } from '@/lib/utils/rating';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreHorizontalIcon, Film02Icon } from '@hugeicons/core-free-icons';
import { OptimizedFadeImage } from '@/components/ui/OptimizedFadeImage';
import { MovieBadges } from '@/components/molecules/MovieBadges';
import { RatingBadge as UserRatingBadge } from './RatingStars';
import { Badge } from '@/components/ui/badge';
import { WatchTimer, useWatchProgress } from './WatchTimer';
import { WatchCompletePrompt } from './WatchCompletePrompt';
import { MovieDetailModal } from './MovieDetailModal';
import { Large } from '@/components/ui/typography';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  posterUrl?: string | null; // Direct URL (for Kinopoisk)
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
  overview: string | null;
  overviewRu: string | null;
  imdbRating: string | null;
  kinopoiskRating?: string | null;
  rottenTomatoesRating: string | null;
  mediaType?: 'movie' | 'tv';
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
}

type MovieSource = 'tmdb' | 'omdb' | 'kinopoisk';

interface MovieListItemProps {
  id?: string;
  tmdbId: number;
  imdbId?: string | null;
  kinopoiskId?: number | null;
  status?: MovieStatus | null;
  rating?: number | null;
  movie: MovieData | null;
  watchStartedAt?: string | null;
  onStatusChange?: (status: MovieStatus) => void;
  onRatingChange?: (rating: number) => void;
  onRemove?: () => void;
  onWatchComplete?: (rating: number) => void;
  onWatchNotYet?: () => void;
  onAddedToList?: () => void;
  showStatusBadge?: boolean;
  showRatingBadge?: boolean;
  showMediaTypeBadge?: boolean;
  canAddToList?: boolean;
  source?: MovieSource;
  /** Set to true for the first item to prioritize LCP image loading */
  priority?: boolean;
}

export function MovieListItem({
  tmdbId,
  imdbId,
  kinopoiskId,
  status = null,
  rating = null,
  movie,
  watchStartedAt = null,
  onStatusChange,
  onRatingChange,
  onRemove,
  onWatchComplete,
  onWatchNotYet,
  onAddedToList,
  showStatusBadge = true,
  showRatingBadge = true,
  showMediaTypeBadge = true,
  canAddToList = true,
  source,
  priority = false,
}: MovieListItemProps) {
  const t = useTranslations('lists');
  const locale = useLocale();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  // Handle poster URL - use semantic 'thumbnail' size for list items
  const posterUrl = movie?.posterPath
    ? getPosterUrl(movie.posterPath, 'thumbnail')
    : movie?.posterUrl
      ? movie.posterUrl
      : '/placeholder-poster.png';

  // Parse and translate genres using memoized hook
  const genres = useGenres(movie?.genres ?? null, locale);

  // Check if watch timer is complete
  const isWatchComplete = useWatchProgress(watchStartedAt, movie?.runtime || null);
  // Show timer only if watching, has start time, and timer not complete
  const showTimer = watchStartedAt && status === MOVIE_STATUS.WATCHING && !isWatchComplete;
  // Show prompt if watching and either no start time (bug recovery) or timer complete
  const showPrompt = status === MOVIE_STATUS.WATCHING && (!watchStartedAt || isWatchComplete);

  // Calculate average rating from all available platforms
  const averageRating = movie
    ? calculateAverageRatingFromStrings(
        movie.voteAverage,
        movie.imdbRating,
        movie.kinopoiskRating
      )
    : null;

  const handleWatchComplete = async (selectedRating: number) => {
    if (!onWatchComplete) return;
    setIsLoading(true);
    try {
      await onWatchComplete(selectedRating);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotYet = async () => {
    if (!onWatchNotYet) return;
    setIsLoading(true);
    try {
      await onWatchNotYet();
    } finally {
      setIsLoading(false);
    }
  };

  // Display Russian title if available
  const displayTitle = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;

  return (
    <div className="overflow-hidden">
      {/* Main row */}
      <div
        className="flex cursor-pointer gap-3"
        onClick={() => setIsSheetOpen(true)}
      >
        {/* Poster */}
        <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
          {movie?.posterPath || movie?.posterUrl ? (
            <OptimizedFadeImage
              src={posterUrl}
              alt={displayTitle}
              fill
              sizes="80px"
              className="object-cover"
              priority={priority}
              fallback={
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={Film02Icon} size={32} />
                </div>
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Film02Icon} size={32} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          <Large className="text-foreground line-clamp-2">
            {displayTitle}
          </Large>

          {/* All badges in one container */}
          <div className="flex flex-wrap items-center gap-1">
            {/* Movie metadata badges */}
            <MovieBadges
              variant="list"
              mediaType={movie?.mediaType}
              releaseDate={movie?.releaseDate}
              runtime={movie?.runtime}
              numberOfSeasons={movie?.numberOfSeasons}
              numberOfEpisodes={movie?.numberOfEpisodes}
              genres={genres}
              averageRating={averageRating}
              showMediaType={showMediaTypeBadge}
            />
            {/* Watching badge - always shown */}
            {status === MOVIE_STATUS.WATCHING && (
              <Badge variant="watching">
                {t('watching', { defaultValue: 'Watching' })}
              </Badge>
            )}
            {/* Watched badge - only in "All" tab */}
            {showStatusBadge && status === MOVIE_STATUS.WATCHED && (
              <Badge variant="watched">
                {t('watched', { defaultValue: 'Watched' })}
              </Badge>
            )}
            {/* Want to watch badge - only in "All" tab */}
            {showStatusBadge && status === MOVIE_STATUS.WANT_TO_WATCH && (
              <Badge variant="wantToWatch">
                {t('wantToWatch', { defaultValue: 'Want to watch' })}
              </Badge>
            )}
            {/* User rating badge */}
            {showRatingBadge && <UserRatingBadge rating={rating} />}
          </div>

          {/* Watch timer (when active and not complete) */}
          {showTimer && (
            <div className="mt-1">
              <WatchTimer
                watchStartedAt={watchStartedAt}
                runtime={movie?.runtime || null}
              />
            </div>
          )}
        </div>

        {/* More icon */}
        <div className="flex items-center text-muted-foreground">
          <HugeiconsIcon icon={MoreHorizontalIcon} size={20} />
        </div>
      </div>

      {/* Watch complete prompt (inline, below main row) */}
      <AnimatePresence>
        {showPrompt && (
          <WatchCompletePrompt
            movieTitle={displayTitle}
            onWatched={handleWatchComplete}
            onNotFinished={handleNotYet}
            isLoading={isLoading}
          />
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <MovieDetailModal
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        tmdbId={tmdbId}
        imdbId={imdbId}
        kinopoiskId={kinopoiskId}
        status={status}
        rating={rating}
        movie={movie}
        onStatusChange={onStatusChange}
        onRatingChange={onRatingChange}
        onRemove={onRemove}
        onAddedToList={onAddedToList}
        canAddToList={canAddToList}
        source={source}
      />
    </div>
  );
}
