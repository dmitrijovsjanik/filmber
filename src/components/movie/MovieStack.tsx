'use client';

import { useCallback, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { MovieCard, MovieCardRef } from './MovieCard';
import { useSwipeStore } from '@/stores/swipeStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSocket } from '@/hooks/useSocket';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useIsAuthenticated, useAuthToken } from '@/stores/authStore';
import type { Movie } from '@/types/movie';
import type { UserSlot } from '@/types/room';

interface MovieStackProps {
  movies: Movie[];
  roomCode: string;
  userSlot: UserSlot;
}

export function MovieStack({
  movies,
  roomCode,
  userSlot,
}: MovieStackProps) {
  const t = useTranslations('swipe');
  const locale = useLocale();
  const { addSwipe } = useSwipeStore();
  const { getVisibleMovies, consumeNext, currentIndex, queue, isInitialized } = useQueueStore();
  const { emitSwipe } = useSocket(roomCode, userSlot);
  const { trackSwipe } = useAnalytics();
  const topCardRef = useRef<MovieCardRef | null>(null);

  // Auth state for saving liked movies
  const isAuthenticated = useIsAuthenticated();
  const token = useAuthToken();

  // Refs to hold latest values for stable callback
  const stateRef = useRef({ isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext });
  useEffect(() => {
    stateRef.current = { isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext };
  });

  // Callback ref to ensure proper assignment
  const setTopCardRef = useCallback((instance: MovieCardRef | null) => {
    if (instance !== null) {
      topCardRef.current = instance;
    }
  }, []);

  // Stable callback that reads from refs
  const handleSwipe = useCallback(
    (direction: 'left' | 'right', movieId: number) => {
      const { isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext } = stateRef.current;
      const action = direction === 'right' ? 'like' : 'skip';
      addSwipe(movieId, action === 'like');
      emitSwipe(movieId, action);
      trackSwipe(direction, movieId);

      // If authenticated and liked, save to list with watch timer
      if (direction === 'right' && isAuthenticated && token) {
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

      consumeNext();
    },
    []
  );

  // Get visible cards from queue (current + next 2)
  // Use queue if initialized, fallback to legacy movies prop
  const visibleItems = isInitialized ? getVisibleMovies(3) : [];
  const visibleMovies = isInitialized
    ? visibleItems.map((item) => item.movie)
    : movies.slice(currentIndex, currentIndex + 3);

  const handleButtonClick = (direction: 'left' | 'right') => {
    if (topCardRef.current && visibleMovies[0]) {
      topCardRef.current.swipe(direction);
    }
  };

  // Check if we've run out of movies
  const totalMovies = isInitialized ? queue.length : movies.length;
  if (currentIndex >= totalMovies) {
    return (
      <div className="flex flex-col items-center justify-center h-[520px] text-center px-4">
        <div className="text-6xl mb-4">🎬</div>
        <p className="text-xl text-gray-500 dark:text-gray-400">
          {t('noMoreMovies')}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          {t('waitForPartner')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Card stack */}
      <div className="relative w-[340px] h-[520px]">
        <AnimatePresence>
          {/* Render in reverse order so top card is rendered last (on top) */}
          {[...visibleMovies].reverse().map((movie, index) => {
            const isTop = index === visibleMovies.length - 1;
            return (
              <MovieCard
                key={`${movie.tmdbId}-${currentIndex}`}
                ref={isTop ? setTopCardRef : null}
                movie={movie}
                onSwipe={handleSwipe}
                isTop={isTop}
                locale={locale}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex gap-8">
        <button
          onClick={() => handleButtonClick('left')}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/25 transition-transform hover:scale-110 active:scale-95"
          aria-label="Skip"
        >
          <svg
            className="w-8 h-8 text-white"
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
          className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 transition-transform hover:scale-110 active:scale-95"
          aria-label="Like"
        >
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>

    </div>
  );
}
