'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RatingStars } from './RatingStars';
import { Badge } from '@/components/ui/badge';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { useAuthToken } from '@/stores/authStore';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
  overview: string | null;
  overviewRu: string | null;
  imdbRating: string | null;
  rottenTomatoesRating: string | null;
}

interface MovieDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number;
  status?: MovieStatus | null;
  rating?: number | null;
  movie: MovieData | null;
  onStatusChange?: (status: MovieStatus) => void;
  onRatingChange?: (rating: number) => void;
  onRemove?: () => void;
  onAddedToList?: () => void;
}

export function MovieDetailSheet({
  isOpen,
  onClose,
  tmdbId,
  status = null,
  rating = null,
  movie,
  onStatusChange,
  onRatingChange,
  onRemove,
  onAddedToList,
}: MovieDetailSheetProps) {
  const t = useTranslations('lists');
  const tCommon = useTranslations('common');
  const token = useAuthToken();
  const [isLoading, setIsLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<MovieStatus | null>(status ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Determine if this is a search result (no status yet) or a list item
  const isSearchMode = status === null;
  const currentStatus = isSearchMode ? localStatus : status;

  const displayTitle = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;
  const secondaryTitle = movie?.titleRu && movie?.titleRu !== movie?.title ? movie.title : null;
  const displayOverview = movie?.overviewRu || movie?.overview;

  const posterUrl = movie?.posterPath
    ? `https://image.tmdb.org/t/p/w200${movie.posterPath}`
    : null;

  const year = movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const genres: string[] = movie?.genres ? JSON.parse(movie.genres) : [];

  // Add movie to list (for search mode)
  const addToList = async (newStatus: MovieStatus) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tmdbId,
          status: newStatus,
          source: 'manual',
        }),
      });
      if (response.ok) {
        setLocalStatus(newStatus);
        onAddedToList?.();
      }
    } catch (err) {
      console.error('Failed to add to list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add with rating (for search mode "watched" selection)
  const addToListWithRating = async (selectedRating: number) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tmdbId,
          status: MOVIE_STATUS.WATCHED,
          rating: selectedRating,
          source: 'manual',
        }),
      });
      if (response.ok) {
        setLocalStatus(MOVIE_STATUS.WATCHED);
        onAddedToList?.();
      }
    } catch (err) {
      console.error('Failed to add to list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusClick = (newStatus: MovieStatus) => {
    if (isSearchMode) {
      // Search mode: add to list via API
      addToList(newStatus);
    } else {
      // List mode: use callback
      onStatusChange?.(newStatus);
    }
  };

  const handleMoveToWantToWatch = () => {
    onStatusChange?.(MOVIE_STATUS.WANT_TO_WATCH);
    onRatingChange?.(0);
  };

  const handleRemove = () => {
    onRemove?.();
    setShowDeleteConfirm(false);
    onClose();
  };

  // Handle rating click - sets rating and marks as watched
  const handleRatingClick = async (selectedRating: number) => {
    if (isSearchMode) {
      // Search mode: add to list with rating via API
      addToListWithRating(selectedRating);
    } else {
      // List mode: update rating and status
      onRatingChange?.(selectedRating);
      if (selectedRating > 0 && currentStatus !== MOVIE_STATUS.WATCHED) {
        onStatusChange?.(MOVIE_STATUS.WATCHED);
      }
    }
  };

  // Derived state
  const isWatched = currentStatus === MOVIE_STATUS.WATCHED;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="max-h-[80vh] flex flex-col rounded-t-2xl">
          {/* Header with poster and title - fixed */}
          <SheetHeader className="text-left flex-shrink-0">
            <div className="flex gap-3">
              {/* Poster */}
              {posterUrl && (
                <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={posterUrl}
                    alt={displayTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col justify-center overflow-hidden">
                <SheetTitle className="pr-8 line-clamp-2">{displayTitle}</SheetTitle>
                {secondaryTitle && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{secondaryTitle}</p>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Badges - fixed */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 flex-shrink-0">
            {/* Year */}
            {year && (
              <Badge variant="secondary">{year}</Badge>
            )}
            {/* Runtime */}
            {movie?.runtime && (
              <Badge variant="secondary">{movie.runtime} min</Badge>
            )}
            {/* Genres */}
            {genres.slice(0, 3).map((genre) => (
              <Badge key={genre} variant="secondary">{genre}</Badge>
            ))}
            {/* Platform ratings */}
            {movie?.voteAverage && (
              <Badge variant="tmdb">TMDB {parseFloat(movie.voteAverage).toFixed(1)}</Badge>
            )}
            {movie?.imdbRating && (
              <Badge variant="imdb">IMDb {parseFloat(movie.imdbRating).toFixed(1)}</Badge>
            )}
            {movie?.rottenTomatoesRating && (
              <Badge variant="rt">RT {parseFloat(movie.rottenTomatoesRating).toFixed(1)}</Badge>
            )}
          </div>

          {/* Overview - scrollable */}
          {displayOverview && (
            <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
              <p className="text-sm text-foreground leading-relaxed">
                {displayOverview}
              </p>
            </div>
          )}

          {/* Actions section - fixed at bottom */}
          <div className="mt-4 flex items-center justify-center gap-4 flex-shrink-0 pb-2">
            {/* Undo button - only for watched items in list mode */}
            {isWatched && !isSearchMode && (
              <button
                onClick={handleMoveToWantToWatch}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title={t('moveToWantToWatch', { defaultValue: 'Move back to "Want to watch"' })}
              >
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={24} />
              </button>
            )}

            {/* Want to Watch button - only for search results (no status yet) */}
            {isSearchMode && !currentStatus && (
              <Button
                variant="secondary"
                onClick={() => handleStatusClick(MOVIE_STATUS.WANT_TO_WATCH)}
                disabled={isLoading}
                className="h-10"
              >
                {t('wantToWatch', { defaultValue: 'Want to watch' })}
              </Button>
            )}

            {/* Rating stars - always visible */}
            <RatingStars
              rating={rating}
              onChange={handleRatingClick}
              size="md"
            />

            {/* Delete button - only for list items */}
            {!isSearchMode && onRemove && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                title={t('removeFromList', { defaultValue: 'Remove from list' })}
              >
                <HugeiconsIcon icon={Delete02Icon} size={24} />
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete', { defaultValue: 'Remove from list?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteDescription', {
                defaultValue: 'This will remove "{title}" from your list.',
                title: displayTitle
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('removeFromList', { defaultValue: 'Remove' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
