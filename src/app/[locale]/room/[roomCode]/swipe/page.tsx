'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { MovieStack } from '@/components/movie/MovieStack';
import { WaitingRoom } from '@/components/room/WaitingRoom';
import { MatchFound } from '@/components/room/MatchFound';
import { Loader } from '@/components/ui/Loader';
import { useRoomStore } from '@/stores/roomStore';
import { useSwipeStore } from '@/stores/swipeStore';
import { useSocket } from '@/hooks/useSocket';
import type { Movie } from '@/types/movie';

export default function SwipePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;

  const {
    pin,
    userSlot,
    moviePoolSeed,
    isPartnerConnected,
    isRoomReady,
    isMatchFound,
    matchedMovieId,
    reset: resetRoom,
  } = useRoomStore();

  const { reset: resetSwipe } = useSwipeStore();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize socket connection
  const { disconnect } = useSocket(roomCode, userSlot);

  // Fetch movies when room is ready
  useEffect(() => {
    if (!moviePoolSeed) {
      router.push(`/${locale}`);
      return;
    }

    const fetchMovies = async () => {
      try {
        const response = await fetch(`/api/movies?seed=${moviePoolSeed}`);
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
  }, [moviePoolSeed, locale, router]);

  // Handle leave room
  const handleLeaveRoom = () => {
    disconnect();
    resetRoom();
    resetSwipe();
    router.push(`/${locale}`);
  };

  // Find matched movie
  const matchedMovie = movies.find((m) => m.tmdbId === matchedMovieId);

  // Show match found screen
  if (isMatchFound && matchedMovie) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <MatchFound movie={matchedMovie} />
        <button
          onClick={handleLeaveRoom}
          className="mt-8 px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t('common.backToHome')}
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
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
          <button
            onClick={handleLeaveRoom}
            className="text-pink-500 hover:underline"
          >
            {t('errors.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  // Show waiting room for room creator (User A) until partner joins
  if (userSlot === 'A' && !isRoomReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <WaitingRoom
          roomCode={roomCode}
          pin={pin || ''}
          isPartnerConnected={isPartnerConnected}
          onCancel={handleLeaveRoom}
        />
      </div>
    );
  }

  // Show waiting for partner to connect (for User B if room not ready yet)
  if (!isRoomReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Loader size="lg" />
        <p className="mt-4 text-gray-500">
          {t('room.connecting')}
        </p>
      </div>
    );
  }

  // Main swipe interface
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-10">
        <button
          onClick={handleLeaveRoom}
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

      {/* Movie stack */}
      {movies.length > 0 && userSlot && (
        <MovieStack
          movies={movies}
          roomCode={roomCode}
          userSlot={userSlot}
        />
      )}
    </div>
  );
}
