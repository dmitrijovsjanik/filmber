'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { translateGenres } from '@/lib/genres';
import { calculateAverageRatingFromStrings } from '@/lib/utils/rating';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { MovieBadges } from '@/components/molecules/MovieBadges';
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
// import { SimilarMoviesSection } from './SimilarMoviesSection'; // TODO: Move to separate page
import { SeasonsAccordion } from '@/components/movie/SeasonsAccordion';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { Muted, Small } from '@/components/ui/typography';
import { useAuthToken } from '@/stores/authStore';
import { useAnalytics } from '@/hooks/useAnalytics';

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

interface MovieDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number;
  imdbId?: string | null;
  kinopoiskId?: number | null;
  status?: MovieStatus | null;
  rating?: number | null;
  movie: MovieData | null;
  onStatusChange?: (status: MovieStatus) => void;
  onRatingChange?: (rating: number) => void;
  onRemove?: () => void;
  onAddedToList?: () => void;
  canAddToList?: boolean;
  source?: MovieSource;
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
  canAddToList = true,
}: MovieDetailSheetProps) {
  const t = useTranslations('lists');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const token = useAuthToken();
  const { trackMovieDetailsOpened, trackMovieAddedToWatchlist, trackMovieRated } = useAnalytics();
  const [isLoading, setIsLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<MovieStatus | null>(status ?? null);
  const [localRating, setLocalRating] = useState<number | null>(rating ?? null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);

  // Sync local rating with props when they change (e.g., when sheet reopens)
  useEffect(() => {
    setLocalRating(rating ?? null);
  }, [rating]);

  // Sync local status with props when they change
  useEffect(() => {
    setLocalStatus(status ?? null);
  }, [status]);

  // Track when sheet opens
  useEffect(() => {
    if (isOpen && !hasTrackedOpen) {
      trackMovieDetailsOpened(tmdbId);
      setHasTrackedOpen(true);
    }
    if (!isOpen) {
      setHasTrackedOpen(false);
    }
  }, [isOpen, tmdbId, hasTrackedOpen, trackMovieDetailsOpened]);

  // Determine if this is a search result (no status yet) or a list item
  const isSearchMode = status === null;
  const currentStatus = isSearchMode ? localStatus : status;

  const displayTitle = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;
  const secondaryTitle = movie?.titleRu && movie?.titleRu !== movie?.title ? movie.title : null;
  const displayOverview = movie?.overviewRu || movie?.overview;

  const posterUrl = movie?.posterPath
    ? `/api/tmdb-image?path=${encodeURIComponent(movie.posterPath)}&size=w342`
    : movie?.posterUrl
      ? movie.posterUrl
      : null;

  // Parse and translate genres from JSON string
  // Handle both old format [{id, name}] and new format ["Drama", "Action"]
  let rawGenres: string[] = [];
  if (movie?.genres) {
    try {
      const parsed = JSON.parse(movie.genres);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'object' && parsed[0] !== null && 'name' in parsed[0]) {
          rawGenres = parsed.map((g: { name: string }) => g.name);
        } else {
          rawGenres = parsed;
        }
      }
    } catch {
      rawGenres = [];
    }
  }
  const genres = translateGenres(rawGenres, locale);

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
        if (newStatus === MOVIE_STATUS.WANT_TO_WATCH) {
          trackMovieAddedToWatchlist(tmdbId);
        }
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

    // Optimistic update - show rating immediately
    setLocalRating(selectedRating);
    setLocalStatus(MOVIE_STATUS.WATCHED);

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
        trackMovieRated(tmdbId, selectedRating);
        onAddedToList?.();
      } else {
        // Revert on error
        setLocalRating(rating ?? null);
        setLocalStatus(status ?? null);
      }
    } catch (err) {
      console.error('Failed to add to list:', err);
      // Revert on error
      setLocalRating(rating ?? null);
      setLocalStatus(status ?? null);
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
    // Optimistic update
    setLocalStatus(MOVIE_STATUS.WANT_TO_WATCH);
    setLocalRating(null);
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
      // List mode: optimistic update + callback
      setLocalRating(selectedRating || null);
      if (selectedRating > 0 && currentStatus !== MOVIE_STATUS.WATCHED) {
        setLocalStatus(MOVIE_STATUS.WATCHED);
        onStatusChange?.(MOVIE_STATUS.WATCHED);
      }
      if (selectedRating > 0) {
        trackMovieRated(tmdbId, selectedRating);
      }
      onRatingChange?.(selectedRating);
    }
  };

  // Derived state
  const isWatched = currentStatus === MOVIE_STATUS.WATCHED;

  // Calculate average rating from all available platforms
  const averageRating = movie
    ? calculateAverageRatingFromStrings(
        movie.voteAverage,
        movie.imdbRating,
        movie.kinopoiskRating,
        movie.rottenTomatoesRating
      )
    : null;

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <Muted className="mt-1 line-clamp-1">{secondaryTitle}</Muted>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Badges - fixed */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 flex-shrink-0">
            <MovieBadges
              variant="card"
              mediaType={movie?.mediaType}
              releaseDate={movie?.releaseDate}
              runtime={movie?.runtime}
              numberOfSeasons={movie?.numberOfSeasons}
              numberOfEpisodes={movie?.numberOfEpisodes}
              genres={genres}
              averageRating={averageRating}
              maxGenres={3}
              showMediaType={movie?.mediaType === 'tv'}
            />
          </div>

          {/* Scrollable content area */}
          <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
            {/* Overview */}
            {displayOverview && (
              <Small className="text-foreground font-normal leading-relaxed">
                {displayOverview}
              </Small>
            )}

            {/* Seasons accordion for TV series */}
            {movie?.mediaType === 'tv' && movie.numberOfSeasons && movie.numberOfSeasons > 0 && (
              <SeasonsAccordion
                tvId={tmdbId}
                numberOfSeasons={movie.numberOfSeasons}
              />
            )}

            {/* TODO: Similar movies moved to separate page */}
          </div>

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

            {/* Want to Watch button - only for search results (no status yet) and if can add to list */}
            {isSearchMode && !currentStatus && canAddToList && (
              <Button
                variant="secondary"
                onClick={() => handleStatusClick(MOVIE_STATUS.WANT_TO_WATCH)}
                disabled={isLoading}
                className="h-10"
              >
                {t('wantToWatch', { defaultValue: 'Want to watch' })}
              </Button>
            )}

            {/* Rating stars - always visible, interactive only if can add to list or already in list */}
            <RatingStars
              rating={localRating}
              onChange={canAddToList || !isSearchMode ? handleRatingClick : undefined}
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
