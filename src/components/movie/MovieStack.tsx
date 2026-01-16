'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Film02Icon, Cancel01Icon, FavouriteIcon } from '@hugeicons/core-free-icons';
import { MovieCard, MovieCardRef } from './MovieCard';
import { useSwipeStore } from '@/stores/swipeStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSocket } from '@/hooks/useSocket';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCardStackHeight } from '@/hooks/useCardStackHeight';
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
  const cardStackHeight = useCardStackHeight();
  const { addSwipe } = useSwipeStore();
  const { getVisibleMovies, consumeNext, currentIndex, queue, isInitialized } = useQueueStore();
  const { emitSwipe } = useSocket(roomCode, userSlot);
  const { trackSwipe } = useAnalytics();
  const topCardRef = useRef<MovieCardRef | null>(null);

  // Global swipe lock to prevent multiple cards swiping at once
  const [isSwipeLocked, setIsSwipeLocked] = useState(false);
  const swipeLockRef = useRef(false);

  // Auth state for saving liked movies
  const isAuthenticated = useIsAuthenticated();
  const token = useAuthToken();

  // Refs to hold latest values for stable callback
  const stateRef = useRef({ isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext, setIsSwipeLocked });
  useEffect(() => {
    stateRef.current = { isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext, setIsSwipeLocked };
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
      // Check and set swipe lock synchronously to prevent race conditions
      if (swipeLockRef.current) return;
      swipeLockRef.current = true;

      const { isAuthenticated, token, addSwipe, emitSwipe, trackSwipe, consumeNext, setIsSwipeLocked } = stateRef.current;
      setIsSwipeLocked(true);

      const action = direction === 'right' ? 'like' : 'skip';
      addSwipe(movieId, action === 'like');
      emitSwipe(movieId, action);
      trackSwipe(direction, movieId);

      // If authenticated and liked, save to "want to watch" list
      // Note: Only matched movies get "watching" status (with timer) - handled by match event
      if (direction === 'right' && isAuthenticated && token) {
        fetch('/api/lists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tmdbId: movieId,
            status: 'want_to_watch',
            source: 'swipe',
          }),
        }).catch(console.error);
      }

      consumeNext();

      // Unlock after exit animation completes (350ms exit duration + buffer)
      setTimeout(() => {
        swipeLockRef.current = false;
        setIsSwipeLocked(false);
      }, 400);
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
    if (swipeLockRef.current) return; // Prevent button clicks during animation
    if (topCardRef.current && visibleMovies[0]) {
      topCardRef.current.swipe(direction);
    }
  };

  // Check if we've run out of movies
  const totalMovies = isInitialized ? queue.length : movies.length;
  if (currentIndex >= totalMovies) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4" style={{ height: cardStackHeight }}>
        <div className="mb-4 text-muted-foreground">
          <HugeiconsIcon icon={Film02Icon} size={64} />
        </div>
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
      <div className="relative w-[min(340px,calc(100vw-32px))]" style={{ height: cardStackHeight }}>
        <AnimatePresence mode="popLayout">
          {/* Render in reverse order so top card is rendered last (on top) */}
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
                isSwipeLocked={isSwipeLocked}
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
          <HugeiconsIcon icon={Cancel01Icon} size={32} className="text-white" strokeWidth={2.5} />
        </button>

        <button
          onClick={() => handleButtonClick('right')}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/25 transition-transform hover:scale-110 active:scale-95"
          aria-label="Like"
        >
          <HugeiconsIcon icon={FavouriteIcon} size={32} className="text-white" fill="currentColor" />
        </button>
      </div>

    </div>
  );
}
