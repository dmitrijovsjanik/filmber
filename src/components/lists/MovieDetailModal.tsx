'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { translateGenres } from '@/lib/genres';
import { calculateAverageRatingFromStrings } from '@/lib/utils/rating';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  Delete02Icon,
  Film02Icon,
} from '@hugeicons/core-free-icons';
import { MovieBadges } from '@/components/molecules/MovieBadges';
import { FadeImage } from '@/components/ui/FadeImage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SeasonsAccordion } from '@/components/movie/SeasonsAccordion';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { useAuthToken } from '@/stores/authStore';
import { useAnalytics } from '@/hooks/useAnalytics';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  posterUrl?: string | null;
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

interface MovieDetailModalProps {
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

export function MovieDetailModal({
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
}: MovieDetailModalProps) {
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

  // Swipe-to-close state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  // Sync local rating with props when they change
  useEffect(() => {
    setLocalRating(rating ?? null);
  }, [rating]);

  // Sync local status with props when they change
  useEffect(() => {
    setLocalStatus(status ?? null);
  }, [status]);

  // Track when modal opens
  useEffect(() => {
    if (isOpen && !hasTrackedOpen) {
      trackMovieDetailsOpened(tmdbId);
      setHasTrackedOpen(true);
    }
    if (!isOpen) {
      setHasTrackedOpen(false);
    }
  }, [isOpen, tmdbId, hasTrackedOpen, trackMovieDetailsOpened]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap (without auto-focus to prevent unwanted focus on back button)
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    panel.addEventListener('keydown', handleTab);
    return () => panel.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Parallax scroll handler - direct DOM manipulation for performance
  const handleScroll = useCallback(() => {
    if (scrollableRef.current && posterRef.current) {
      const scrollTop = scrollableRef.current.scrollTop;
      posterRef.current.style.transform = `translateY(${scrollTop * 0.4}px)`;
    }
  }, []);

  // Swipe-to-close handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touchY = e.touches[0].clientY;
    dragStartY.current = touchY;
    // Don't set isDragging yet - wait for touchmove to determine intent
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const scrollable = scrollableRef.current;
    const isAtTop = !scrollable || scrollable.scrollTop <= 0;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;

    // Start dragging if: at top of scroll AND pulling down
    if (isAtTop && diff > 0) {
      // Prevent scroll when dragging
      if (diff > 10) {
        e.preventDefault();
      }
      setIsDragging(true);
      setDragY(Math.max(0, diff));
    } else if (!isAtTop && isDragging) {
      // Stop dragging if user scrolls up
      setIsDragging(false);
      setDragY(0);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    // Close if dragged more than 150px
    if (dragY > 150) {
      onClose();
    }

    setDragY(0);
    setIsDragging(false);
  }, [isDragging, dragY, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      if (posterRef.current) {
        posterRef.current.style.transform = 'translateY(0)';
      }
    }
  }, [isOpen]);

  const isSearchMode = status === null;
  const currentStatus = isSearchMode ? localStatus : status;
  const isTvSeries = movie?.mediaType === 'tv';

  const displayTitle = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;
  const secondaryTitle = movie?.titleRu && movie?.titleRu !== movie?.title ? movie.title : null;
  const displayOverview = movie?.overviewRu || movie?.overview;

  // Use larger poster for hero image
  const posterUrl = movie?.posterPath
    ? `/api/tmdb-image?path=${encodeURIComponent(movie.posterPath)}&size=w780`
    : movie?.posterUrl
      ? movie.posterUrl
      : null;

  // Parse and translate genres
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
  const addToList = useCallback(async (newStatus: MovieStatus) => {
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
  }, [token, tmdbId, trackMovieAddedToWatchlist, onAddedToList]);

  // Add with rating (for search mode "watched" selection)
  const addToListWithRating = useCallback(async (selectedRating: number) => {
    if (!token) return;

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
        setLocalRating(rating ?? null);
        setLocalStatus(status ?? null);
      }
    } catch (err) {
      console.error('Failed to add to list:', err);
      setLocalRating(rating ?? null);
      setLocalStatus(status ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [token, tmdbId, trackMovieRated, onAddedToList, rating, status]);

  const handleStatusClick = (newStatus: MovieStatus) => {
    if (isSearchMode) {
      addToList(newStatus);
    } else {
      onStatusChange?.(newStatus);
    }
  };

  const handleMoveToWantToWatch = () => {
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

  const handleRatingClick = async (selectedRating: number) => {
    if (isSearchMode) {
      addToListWithRating(selectedRating);
    } else {
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

  const isWatched = currentStatus === MOVIE_STATUS.WATCHED;

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
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/80 transition-opacity duration-500 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`fixed inset-0 z-[60] bg-black dark flex flex-col ease-in-out ${
          isOpen ? '' : 'translate-y-full'
        } ${isDragging ? '' : 'transition-transform duration-500'}`}
        style={{
          transform: isOpen ? `translateY(${dragY}px)` : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-10 h-1 rounded-full bg-white/30" />

        {/* Header with gradient - fixed at top, not affected by parallax */}
        <div className="absolute top-0 left-0 right-0 z-20">
          {/* Gradient background for header */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* Buttons */}
          <div className="relative pt-4 px-4 flex items-center justify-between">
            {/* Back button */}
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60 text-white"
              aria-label={tCommon('back')}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60 text-white"
              aria-label={tCommon('cancel')}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollableRef} className="flex-1 overflow-y-auto pb-[76px]" onScroll={handleScroll}>
          {/* Hero section with poster */}
          <div className="relative overflow-hidden">
            {/* Poster image with parallax effect */}
            <div
              ref={posterRef}
              className="relative aspect-[2/3] w-full max-h-[70vh] will-change-transform"
            >
              {posterUrl ? (
                <FadeImage
                  src={posterUrl}
                  alt={displayTitle}
                  className="h-full w-full object-cover select-none"
                  wrapperClassName="h-full w-full"
                  draggable={false}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-neutral-900">
                      <HugeiconsIcon icon={Film02Icon} size={64} className="text-white/20" />
                    </div>
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-900">
                  <HugeiconsIcon icon={Film02Icon} size={64} className="text-white/20" />
                </div>
              )}
            </div>
          </div>

          {/* Content section with gradient overlay on top */}
          <div className="relative text-white">
            {/* Gradient that blends poster into content */}
            <div className="absolute inset-x-0 bottom-full h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />

            {/* Content with solid black background */}
            <div className="bg-black px-4 pb-4">
              {/* Title */}
              <h1 id="modal-title" className="text-2xl font-bold leading-tight">{displayTitle}</h1>
              {secondaryTitle && (
                <p className="mt-1 text-base text-white/60">{secondaryTitle}</p>
              )}

              {/* Badges */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <MovieBadges
                  variant="list"
                  mediaType={movie?.mediaType}
                  releaseDate={movie?.releaseDate}
                  runtime={movie?.runtime}
                  numberOfSeasons={movie?.numberOfSeasons}
                  numberOfEpisodes={movie?.numberOfEpisodes}
                  genres={genres}
                  averageRating={averageRating}
                  maxGenres={3}
                  showMediaType={isTvSeries}
                />
              </div>

              {/* Tabs for content */}
              {isTvSeries && movie.numberOfSeasons && movie.numberOfSeasons > 0 ? (
                <Tabs defaultValue="overview" className="mt-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="overview" className="flex-1">
                      {t('overview')}
                    </TabsTrigger>
                    <TabsTrigger value="seasons" className="flex-1">
                      {t('seasonsTab')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4">
                    {displayOverview ? (
                      <p className="text-sm text-white/80 font-normal leading-relaxed">
                        {displayOverview}
                      </p>
                    ) : (
                      <p className="text-sm text-white/50">{t('noDescription')}</p>
                    )}
                  </TabsContent>

                  <TabsContent value="seasons" className="mt-4">
                    <SeasonsAccordion
                      tvId={tmdbId}
                      numberOfSeasons={movie.numberOfSeasons}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                /* Just overview for movies */
                <div className="mt-4">
                  {displayOverview ? (
                    <p className="text-sm text-white/80 font-normal leading-relaxed">
                      {displayOverview}
                    </p>
                  ) : (
                    <p className="text-sm text-white/50">{t('noDescription')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer - 76px height */}
        <div className="fixed bottom-0 left-0 right-0 z-[61] border-t border-white/10 bg-black/95 backdrop-blur-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="h-[76px] px-4 flex items-center justify-center gap-4">
            {/* Undo button - only for watched items in list mode */}
            {isWatched && !isSearchMode && (
              <button
                onClick={handleMoveToWantToWatch}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors"
                title={t('moveToWantToWatch', { defaultValue: 'Move back to "Want to watch"' })}
              >
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={24} />
              </button>
            )}

            {/* Want to Watch button - only for search results with no status */}
            {isSearchMode && !currentStatus && canAddToList && (
              <Button
                variant="secondary"
                onClick={() => handleStatusClick(MOVIE_STATUS.WANT_TO_WATCH)}
                disabled={isLoading}
                className="h-10 bg-white/10 hover:bg-white/20 text-white border-0"
              >
                {t('wantToWatch', { defaultValue: 'Want to watch' })}
              </Button>
            )}

            {/* Rating stars */}
            <RatingStars
              rating={localRating}
              onChange={canAddToList || !isSearchMode ? handleRatingClick : undefined}
              size="md"
            />

            {/* Delete button - only for list items */}
            {!isSearchMode && onRemove && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
                title={t('removeFromList', { defaultValue: 'Remove from list' })}
              >
                <HugeiconsIcon icon={Delete02Icon} size={24} />
              </button>
            )}
          </div>
        </div>
      </div>

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
