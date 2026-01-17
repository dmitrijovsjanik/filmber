'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useGenres } from '@/hooks/useGenres';
import { getPosterUrl } from '@/lib/api/poster';
import { calculateAverageRatingFromStrings } from '@/lib/utils/rating';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  Delete02Icon,
  Film02Icon,
  LayoutTopIcon,
  PlayIcon,
  Share01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { MovieBadges } from '@/components/molecules/MovieBadges';
import { OptimizedFadeImage } from '@/components/ui/OptimizedFadeImage';
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
import { TrailerModal } from '@/components/movie/TrailerModal';
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

  // Trailer state
  const [isLoadingTrailer, setIsLoadingTrailer] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  // Expanded poster mode state - persisted in localStorage
  const [isExpandedPoster, setIsExpandedPoster] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('filmber-expanded-poster');
    return saved !== 'false'; // Default to true (expanded)
  });

  // Sync expanded state from localStorage when modal opens
  // This ensures all modals share the same preference
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('filmber-expanded-poster');
      setIsExpandedPoster(saved !== 'false');
    }
  }, [isOpen]);

  // Toggle expanded mode and save preference
  const toggleExpandedPoster = useCallback(() => {
    setIsExpandedPoster(prev => {
      const newValue = !prev;
      localStorage.setItem('filmber-expanded-poster', String(newValue));
      return newValue;
    });
  }, []);

  // Scroll indicator opacity (fades out over first 128px of scroll)
  const [scrollIndicatorOpacity, setScrollIndicatorOpacity] = useState(1);

  // Tab content min-height to prevent layout shift when switching tabs
  const overviewRef = useRef<HTMLDivElement>(null);
  const [tabContentMinHeight, setTabContentMinHeight] = useState(0);

  // Measure overview height when content changes
  useEffect(() => {
    if (overviewRef.current && isOpen) {
      // Use ResizeObserver to track height changes
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          if (height > 0) {
            setTabContentMinHeight(height);
          }
        }
      });
      observer.observe(overviewRef.current);
      return () => observer.disconnect();
    }
  }, [isOpen]);

  // Handle trailer button click
  const handleTrailerClick = useCallback(async () => {
    if (!tmdbId || isLoadingTrailer) return;

    setIsLoadingTrailer(true);
    try {
      const mediaType = movie?.mediaType || 'movie';
      const response = await fetch(`/api/movies/${tmdbId}/trailer?type=${mediaType}`);

      if (response.ok) {
        const data = await response.json();
        if (data.trailer?.key) {
          setTrailerKey(data.trailer.key);
          setShowTrailer(true);
        }
      }
    } catch (error) {
      console.error('Failed to load trailer:', error);
    } finally {
      setIsLoadingTrailer(false);
    }
  }, [tmdbId, movie?.mediaType, isLoadingTrailer]);

  // Handle share button click
  const handleShare = useCallback(async () => {
    if (!tmdbId) return;

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';
    const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app';
    const mediaType = movie?.mediaType || 'movie';
    const startAppParam = `${mediaType}_${tmdbId}`;
    const tgAppUrl = `https://t.me/${botUsername}/${miniAppName}?startapp=${startAppParam}`;

    const title = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: title,
          url: tgAppUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: open Telegram share
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(tgAppUrl)}&text=${encodeURIComponent(title)}`;
      window.open(shareUrl, '_blank');
    }
  }, [tmdbId, movie?.mediaType, movie?.titleRu, movie?.title]);

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

      // Fade out scroll indicator over first 128px of scroll
      const fadeThreshold = 128;
      const newOpacity = Math.max(0, 1 - scrollTop / fadeThreshold);
      setScrollIndicatorOpacity(newOpacity);
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

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      if (posterRef.current) {
        posterRef.current.style.transform = 'translateY(0)';
      }
    } else {
      // Reset scroll indicator opacity when modal opens
      setScrollIndicatorOpacity(1);
      // Reset scroll position
      if (scrollableRef.current) {
        scrollableRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  const isSearchMode = status == null;
  const currentStatus = isSearchMode ? localStatus : status;
  const isTvSeries = movie?.mediaType === 'tv';

  const displayTitle = movie?.titleRu || movie?.title || `Movie #${tmdbId}`;
  const secondaryTitle = movie?.titleRu && movie?.titleRu !== movie?.title ? movie.title : null;
  const displayOverview = movie?.overviewRu || movie?.overview;

  // Use larger poster for hero image (semantic 'hero' size = w780)
  const posterUrl = movie?.posterPath
    ? getPosterUrl(movie.posterPath, 'hero')
    : movie?.posterUrl
      ? movie.posterUrl
      : null;

  // Parse and translate genres using memoized hook
  const genres = useGenres(movie?.genres ?? null, locale);

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
          mediaType: movie?.mediaType,
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
  }, [token, tmdbId, trackMovieAddedToWatchlist, onAddedToList, movie?.mediaType]);

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
          mediaType: movie?.mediaType,
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
  }, [token, tmdbId, trackMovieRated, onAddedToList, rating, status, movie?.mediaType]);

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
        className={`fixed inset-0 z-[60] bg-black dark flex flex-col ease-in-out will-change-transform ${
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
          {/* Gradient background for header - transform-gpu prevents glitch on drag release */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transform-gpu" />

          {/* Buttons - with Telegram safe area padding */}
          <div className="relative px-4 flex items-center justify-between" style={{ paddingTop: 'calc(1rem + var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))' }}>
            {/* Back button */}
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60 text-white"
              aria-label={tCommon('back')}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </button>

            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              {/* Toggle poster mode button */}
              <button
                onClick={toggleExpandedPoster}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60 text-white"
                aria-label={isExpandedPoster ? t('compactView', { defaultValue: 'Compact view' }) : t('expandedView', { defaultValue: 'Expanded view' })}
                title={isExpandedPoster ? t('compactView', { defaultValue: 'Compact view' }) : t('expandedView', { defaultValue: 'Expanded view' })}
              >
                <HugeiconsIcon icon={isExpandedPoster ? LayoutTopIcon : ViewIcon} size={20} />
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
        </div>

        {/* Scrollable content */}
        <div ref={scrollableRef} className="flex-1 overflow-y-auto pb-[76px]" onScroll={handleScroll}>
          {/* Hero section with poster */}
          <div className="relative">
            {/* Poster image with parallax effect */}
            <div
              ref={posterRef}
              className={`relative w-full will-change-transform transition-[height] duration-500 ease-out ${
                isExpandedPoster ? 'h-[calc(100dvh-76px)]' : 'h-[360px]'
              }`}
            >
              {/* Top gradient overlay - smooth fade from black, hides poster edge */}
              <div
                className="absolute inset-x-0 top-0 z-10 pointer-events-none transform-gpu"
                style={{
                  height: '50%',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 15%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.2) 55%, transparent 100%)',
                }}
              />

              {posterUrl ? (
                <OptimizedFadeImage
                  src={posterUrl}
                  alt={displayTitle}
                  fill
                  sizes="100vw"
                  priority
                  className="object-cover select-none"
                  wrapperClassName="h-full w-full"
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

              {/* Gradient overlay at bottom of poster (visible in expanded mode) */}
              <div
                className={`absolute inset-x-0 bottom-0 z-10 pointer-events-none transition-opacity duration-500 transform-gpu ${
                  isExpandedPoster ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  height: '40%',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 40%, transparent 100%)',
                }}
              />
            </div>

            {/* Scroll indicator - outside posterRef so it moves with content, not parallax */}
            {/* Positioned at bottom of hero section, above gradient (z-10) */}
            {isExpandedPoster && scrollIndicatorOpacity > 0 && (
              <div
                className="absolute bottom-6 inset-x-0 z-10 flex justify-center pointer-events-none"
                style={{ opacity: scrollIndicatorOpacity }}
              >
                <div className="flex flex-col items-center gap-1 text-white/70 animate-bounce">
                  <HugeiconsIcon icon={ArrowDown01Icon} size={24} />
                  <span className="text-xs font-medium">{t('scrollForMore')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content section with gradient overlay on top */}
          <div className="relative text-white">
            {/* Gradient that blends poster into content - always visible, moves with content */}
            <div className="absolute inset-x-0 bottom-full h-24 bg-gradient-to-t from-black to-transparent pointer-events-none transform-gpu" />

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
                  variant="card"
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

              {/* Trailer and Share buttons - full width, equal size */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleTrailerClick}
                  disabled={isLoadingTrailer}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-white/10 btn-touch-safe disabled:opacity-50"
                >
                  <HugeiconsIcon icon={PlayIcon} size={18} className={isLoadingTrailer ? 'animate-pulse' : ''} />
                  <span className="text-sm font-medium">{t('watchTrailer')}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full bg-white/10 btn-touch-safe"
                >
                  <HugeiconsIcon icon={Share01Icon} size={18} />
                  <span className="text-sm font-medium">{tCommon('share')}</span>
                </button>
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
                    <div ref={overviewRef}>
                      {displayOverview ? (
                        <p className="text-sm text-white/80 font-normal leading-relaxed">
                          {displayOverview}
                        </p>
                      ) : (
                        <p className="text-sm text-white/50">{t('noDescription')}</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="seasons"
                    className="mt-4"
                    style={{ minHeight: tabContentMinHeight > 0 ? tabContentMinHeight : undefined }}
                  >
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

      {/* Trailer modal */}
      <TrailerModal
        isOpen={showTrailer}
        onClose={() => setShowTrailer(false)}
        videoKey={trailerKey}
        title={displayTitle}
      />
    </>
  );
}
