'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence } from 'framer-motion';
import { MovieCard, MovieCardRef } from '@/components/movie/MovieCard';
import { MatchFound } from '@/components/room/MatchFound';
import { MatchAuthPrompt } from '@/components/auth/MatchAuthPrompt';
import { Loader } from '@/components/ui/Loader';
import { useRoomStore } from '@/stores/roomStore';
import { useSwipeStore, useSwipeStoreHydrated, useLikedMoviesDetails } from '@/stores/swipeStore';
import { useIsAuthenticated, useAuthToken } from '@/stores/authStore';
import { useDeckSettingsStore } from '@/stores/deckSettingsStore';
import { useCardStackHeight } from '@/hooks/useCardStackHeight';
import type { Movie } from '@/types/movie';

export default function SoloSwipePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const {
    moviePoolSeed,
    isSoloMode,
    isMatchFound,
    matchedMovieId,
    setMatchFound,
    setMatchedMovieId,
    reset: resetRoom,
    hasHydrated,
  } = useRoomStore();

  const { addSwipe, addLikedMovieDetails, swipedMovieIds, reset: resetSwipe } = useSwipeStore();
  const swipeStoreHydrated = useSwipeStoreHydrated();
  const likedMoviesDetails = useLikedMoviesDetails();
  const { mediaTypeFilter, loadSettings, isLoaded } = useDeckSettingsStore();
  const cardStackHeight = useCardStackHeight();

  // State for auth prompt modal
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);


  // Auth state for saving liked movies
  const isAuthenticated = useIsAuthenticated();
  const token = useAuthToken();

  // Load deck settings on mount
  useEffect(() => {
    if (!isLoaded) {
      loadSettings();
    }
  }, [isLoaded, loadSettings]);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const topCardRef = useRef<MovieCardRef | null>(null);

  // Refs to hold latest auth values for stable callback
  const authRef = useRef({ isAuthenticated, token });
  useEffect(() => {
    authRef.current = { isAuthenticated, token };
  });

  // Redirect if not in solo mode (wait for hydration first)
  useEffect(() => {
    if (!hasHydrated) return; // Wait for store to hydrate from localStorage
    if (!isSoloMode || !moviePoolSeed) {
      router.push(`/${locale}`);
    }
  }, [hasHydrated, isSoloMode, moviePoolSeed, locale, router]);

  // Fetch movies
  useEffect(() => {
    if (!moviePoolSeed || !isLoaded) return;

    const fetchMovies = async () => {
      try {
        const response = await fetch(
          `/api/movies?seed=${moviePoolSeed}&mediaType=${mediaTypeFilter}&locale=${locale}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch movies');
        }

        setMovies(data.movies);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovies();
  }, [moviePoolSeed, mediaTypeFilter, locale, isLoaded]);

  const setTopCardRef = useCallback((instance: MovieCardRef | null) => {
    if (instance !== null) {
      topCardRef.current = instance;
    }
  }, []);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', movieId: number) => {
      const isLike = direction === 'right';
      // Adding to swipedMovieIds automatically updates remainingMovies via filter
      addSwipe(movieId, isLike);

      // If authenticated and liked, save to list with watch timer
      if (isLike) {
        const { isAuthenticated, token } = authRef.current;

        // Find movie details for storing
        const movie = movies.find((m) => m.tmdbId === movieId);
        if (movie) {
          // Store movie details for auth prompt
          addLikedMovieDetails({
            tmdbId: movie.tmdbId,
            posterPath: movie.posterUrl,
            title: movie.title,
            titleRu: movie.titleRu,
            mediaType: movie.mediaType || 'movie',
          });
        }

        if (isAuthenticated && token) {
          fetch('/api/lists', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tmdbId: movieId,
              status: 'watching',
              source: 'swipe',
            }),
          }).catch(console.error);
        }

        // In solo mode, first like is the match
        setMatchFound(true);
        setMatchedMovieId(movieId);
      }
    },
    [addSwipe, addLikedMovieDetails, movies, setMatchFound, setMatchedMovieId]
  );

  // Filter out already-swiped movies to restore progress on page reload
  const remainingMovies = useMemo(
    () => movies.filter((m) => !swipedMovieIds.includes(m.tmdbId)),
    [movies, swipedMovieIds]
  );

  const handleButtonClick = (direction: 'left' | 'right') => {
    const visibleMovies = remainingMovies.slice(0, 3);
    if (topCardRef.current && visibleMovies[0]) {
      topCardRef.current.swipe(direction);
    }
  };

  const handleLeave = () => {
    resetRoom();
    resetSwipe();
    router.push(`/${locale}`);
  };

  // Find matched movie
  const matchedMovie = movies.find((m) => m.tmdbId === matchedMovieId);

  // Show auth prompt for unauthenticated users on match (once per session)
  const hasShownAuthPromptRef = useRef(false);
  useEffect(() => {
    if (isMatchFound && !isAuthenticated && !hasShownAuthPromptRef.current) {
      hasShownAuthPromptRef.current = true;
      setShowAuthPrompt(true);
    }
  }, [isMatchFound, isAuthenticated]);

  // Show match found screen
  if (isMatchFound && matchedMovie) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <MatchFound movie={matchedMovie} />
        <button
          onClick={handleLeave}
          className="mt-8 px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t('common.backToHome')}
        </button>

        {/* Auth prompt modal for unauthenticated users */}
        <MatchAuthPrompt
          isOpen={showAuthPrompt}
          onClose={() => setShowAuthPrompt(false)}
          onContinueWithoutSave={() => setShowAuthPrompt(false)}
          likedMovies={likedMoviesDetails}
        />
      </div>
    );
  }

  // Loading state (including hydration of both stores)
  if (!hasHydrated || !swipeStoreHydrated || isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Loader size="lg" />
        <p className="mt-4 text-gray-500">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-xl text-red-500 mb-4">{error}</p>
          <button onClick={handleLeave} className="text-pink-500 hover:underline">
            {t('errors.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  // Get visible cards from remaining (non-swiped) movies
  const visibleMovies = remainingMovies.slice(0, 3);

  // No more movies
  if (remainingMovies.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-xl text-gray-500 dark:text-gray-400">
            {t('swipe.noMoreMovies')}
          </p>
          <button
            onClick={handleLeave}
            className="mt-4 text-pink-500 hover:underline"
          >
            {t('errors.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-4 left-4 z-10">
        <button
          onClick={handleLeave}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Card stack */}
      <div className="flex flex-col items-center gap-8">
        <div className="relative w-[min(340px,calc(100vw-32px))]" style={{ height: cardStackHeight }}>
          <AnimatePresence mode="popLayout">
            {[...visibleMovies].reverse().map((movie, index) => {
              const isTop = index === visibleMovies.length - 1;
              // Calculate actual stack position (0 = top)
              const stackIndex = visibleMovies.length - 1 - index;
              return (
                <MovieCard
                  key={movie.tmdbId}
                  ref={isTop ? setTopCardRef : null}
                  movie={movie}
                  onSwipe={handleSwipe}
                  isTop={isTop}
                  locale={locale}
                  stackIndex={stackIndex}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex gap-8">
          <button
            onClick={() => handleButtonClick('left')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/25 transition-transform hover:scale-110 active:scale-95"
            aria-label="Skip"
          >
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <button
            onClick={() => handleButtonClick('right')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 transition-transform hover:scale-110 active:scale-95"
            aria-label="Like"
          >
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
