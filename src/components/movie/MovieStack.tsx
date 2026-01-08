'use client';

import { useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MovieCard, MovieCardRef } from './MovieCard';
import { useSwipeStore } from '@/stores/swipeStore';
import { useSocket } from '@/hooks/useSocket';
import type { Movie } from '@/types/movie';
import type { UserSlot } from '@/types/room';

interface MovieStackProps {
  movies: Movie[];
  roomCode: string;
  userSlot: UserSlot;
  locale?: string;
}

export function MovieStack({
  movies,
  roomCode,
  userSlot,
  locale = 'en',
}: MovieStackProps) {
  const { currentIndex, addSwipe, incrementIndex } = useSwipeStore();
  const { emitSwipe } = useSocket(roomCode, userSlot);
  const topCardRef = useRef<MovieCardRef | null>(null);

  // Callback ref to ensure proper assignment
  // We only set to null explicitly when we want to, not when React unmounts old components
  const setTopCardRef = useCallback((instance: MovieCardRef | null) => {
    console.log('[MovieStack] setTopCardRef called', { instance, hasSwipe: !!instance?.swipe });
    if (instance !== null) {
      topCardRef.current = instance;
    }
  }, []);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right', movieId: number) => {
      const action = direction === 'right' ? 'like' : 'skip';
      addSwipe(movieId, action === 'like');
      emitSwipe(movieId, action);
      incrementIndex();
    },
    [addSwipe, emitSwipe, incrementIndex]
  );

  // Get visible cards (current + next 2)
  const visibleMovies = movies.slice(currentIndex, currentIndex + 3);

  const handleButtonClick = (direction: 'left' | 'right') => {
    console.log('[MovieStack] handleButtonClick called', {
      direction,
      hasRef: !!topCardRef.current,
      hasVisibleMovies: visibleMovies.length > 0,
      topMovieId: visibleMovies[0]?.tmdbId,
      currentIndex
    });
    if (topCardRef.current && visibleMovies[0]) {
      console.log('[MovieStack] Calling swipe on ref');
      topCardRef.current.swipe(direction);
    } else {
      console.log('[MovieStack] Cannot swipe - ref or movies missing');
    }
  };

  if (currentIndex >= movies.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[520px] text-center px-4">
        <div className="text-6xl mb-4">🎬</div>
        <p className="text-xl text-gray-500 dark:text-gray-400">
          {locale === 'ru' ? 'Фильмы закончились!' : 'No more movies!'}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          {locale === 'ru'
            ? 'Подождите, пока партнёр тоже досвайпает'
            : "Wait for your partner to finish swiping"}
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
            console.log('[MovieStack] Rendering card', { movieId: movie.tmdbId, index, isTop, willGetRef: isTop });
            return (
              <MovieCard
                key={`${movie.tmdbId}-${currentIndex}`}
                ref={isTop ? setTopCardRef : null}
                movie={movie}
                onSwipe={(dir) => handleSwipe(dir, movie.tmdbId)}
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

      {/* Progress indicator */}
      <div className="text-sm text-gray-500">
        {currentIndex + 1} / {movies.length}
      </div>
    </div>
  );
}
