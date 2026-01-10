'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RatingStars, RatingBadge } from './RatingStars';
import { WatchTimer, useWatchProgress } from './WatchTimer';
import { WatchCompletePrompt } from './WatchCompletePrompt';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
}

interface MovieListItemProps {
  id: string;
  tmdbId: number;
  status: MovieStatus;
  rating: number | null;
  movie: MovieData | null;
  watchStartedAt: string | null;
  onStatusChange: (status: MovieStatus) => void;
  onRatingChange: (rating: number) => void;
  onRemove: () => void;
  onWatchComplete?: (rating: number) => void;
  onWatchNotYet?: () => void;
}

export function MovieListItem({
  id,
  tmdbId,
  status,
  rating,
  movie,
  watchStartedAt,
  onStatusChange,
  onRatingChange,
  onRemove,
  onWatchComplete,
  onWatchNotYet,
}: MovieListItemProps) {
  const t = useTranslations('lists');
  const tCommon = useTranslations('common');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingWatched, setPendingWatched] = useState(false); // Waiting for rating before changing to watched

  const posterUrl = movie?.posterPath
    ? `https://image.tmdb.org/t/p/w200${movie.posterPath}`
    : '/placeholder-poster.png';

  const year = movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;

  // Check if watch timer is complete
  const isWatchComplete = useWatchProgress(watchStartedAt, movie?.runtime || null);
  const showTimer = watchStartedAt && status === MOVIE_STATUS.WATCHING;
  const showPrompt = showTimer && isWatchComplete;

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

  // Handle click on "Watched" button - show rating picker first
  const handleWatchedClick = () => {
    if (status === MOVIE_STATUS.WATCHED) return; // Already watched
    setPendingWatched(true);
  };

  // Handle rating selection when pending watched
  const handlePendingRating = (selectedRating: number) => {
    onRatingChange(selectedRating);
    onStatusChange(MOVIE_STATUS.WATCHED);
    setPendingWatched(false);
  };

  // Cancel pending watched
  const handleCancelPending = () => {
    setPendingWatched(false);
  };

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-xl bg-gray-800/50"
    >
      {/* Main row */}
      <div
        className="flex cursor-pointer gap-3 p-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Poster */}
        <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700">
          {movie?.posterPath ? (
            <img
              src={posterUrl}
              alt={movie?.title || 'Movie poster'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              🎬
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center gap-1">
          <h3 className="font-semibold text-white line-clamp-2">
            {movie?.title || `Movie #${tmdbId}`}
          </h3>
          {year && <p className="text-sm text-gray-400">{year}</p>}

          {/* Status badge and rating */}
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                status === MOVIE_STATUS.WATCHED
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : status === MOVIE_STATUS.WATCHING
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {status === MOVIE_STATUS.WATCHED
                ? t('watched', { defaultValue: 'Watched' })
                : status === MOVIE_STATUS.WATCHING
                ? t('watching', { defaultValue: 'Watching' })
                : t('wantToWatch', { defaultValue: 'Want to watch' })}
            </span>
            <RatingBadge rating={rating} />
          </div>

          {/* Watch timer (when active and not complete) */}
          {showTimer && !isWatchComplete && (
            <div className="mt-1">
              <WatchTimer
                watchStartedAt={watchStartedAt}
                runtime={movie?.runtime || null}
              />
            </div>
          )}
        </div>

        {/* Expand arrow */}
        <div className="flex items-center text-gray-500">
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            ▼
          </motion.span>
        </div>
      </div>

      {/* Watch complete prompt (inline, below main row) */}
      <AnimatePresence>
        {showPrompt && (
          <WatchCompletePrompt
            movieTitle={movie?.title || `Movie #${tmdbId}`}
            onWatched={handleWatchComplete}
            onNotYet={handleNotYet}
            isLoading={isLoading}
          />
        )}
      </AnimatePresence>

      {/* Expanded actions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-700"
          >
            <div className="space-y-4 p-4">
              {/* Status toggle */}
              {!pendingWatched ? (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    {t('status', { defaultValue: 'Status' })}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onStatusChange(MOVIE_STATUS.WANT_TO_WATCH)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        status === MOVIE_STATUS.WANT_TO_WATCH
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      📋 {t('wantToWatch', { defaultValue: 'Want to watch' })}
                    </button>
                    <button
                      onClick={handleWatchedClick}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        status === MOVIE_STATUS.WATCHED
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      ✅ {t('watched', { defaultValue: 'Watched' })}
                    </button>
                  </div>
                </div>
              ) : (
                /* Rating selection before marking as watched */
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    {t('yourRating', { defaultValue: 'Your rating' })}
                  </label>
                  <RatingStars rating={null} onChange={handlePendingRating} size="lg" />
                  <button
                    onClick={handleCancelPending}
                    className="mt-2 text-sm text-gray-400 hover:text-gray-300"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              )}

              {/* Rating (only for already watched - allow changing) */}
              {status === MOVIE_STATUS.WATCHED && !pendingWatched && (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    {t('yourRating', { defaultValue: 'Your rating' })}
                  </label>
                  <RatingStars rating={rating} onChange={onRatingChange} size="lg" />
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={onRemove}
                className="w-full rounded-lg bg-red-500/10 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
              >
                🗑️ {t('removeFromList', { defaultValue: 'Remove from list' })}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
