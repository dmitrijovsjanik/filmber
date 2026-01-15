'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { MovieStack } from '@/components/movie/MovieStack';
import { WaitingRoom } from '@/components/room/WaitingRoom';
import { MatchFound } from '@/components/room/MatchFound';
import { Loader } from '@/components/ui/Loader';
import { useRoomStore } from '@/stores/roomStore';
import { useSwipeStore } from '@/stores/swipeStore';
import { useQueueStore, useShouldFetchMore, useQueueMeta } from '@/stores/queueStore';
import { useSocket } from '@/hooks/useSocket';
import type { Movie } from '@/types/movie';

// Initial load: 20 movies (10 per user in the bidirectional pool)
const INITIAL_LIMIT = 20;
// Fetch more: 10 movies at a time
const FETCH_MORE_LIMIT = 10;

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
    partnerHasWatchlist,
    setPartnerHasWatchlist,
    reset: resetRoom,
  } = useRoomStore();

  const { reset: resetSwipe } = useSwipeStore();
  const { initializeQueue, appendMovies, setFetchingMore, reset: resetQueue, queue, currentIndex } = useQueueStore();
  const shouldFetchMore = useShouldFetchMore();
  const queueMeta = useQueueMeta();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const hasRefetchedForPartner = useRef(false);
  const [fetchedMatchMovie, setFetchedMatchMovie] = useState<Movie | null>(null);

  // Initialize socket connection
  const { disconnect } = useSocket(roomCode, userSlot);

  // Fetch queue function (extracted for reuse)
  const fetchQueue = useCallback(async (isRefetch = false) => {
    if (!moviePoolSeed || !userSlot) return;

    try {
      // Use new queue API for personalized movie order
      const response = await fetch(
        `/api/rooms/${roomCode}/queue?userSlot=${userSlot}&limit=${INITIAL_LIMIT}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch movies');
      }

      // Initialize queueStore with the fetched data
      const queueItems = data.movies.map(
        (item: { movie: Movie; source: string }) => ({
          movie: item.movie,
          source: item.source,
        })
      );

      // On refetch, merge new priority items into existing queue
      if (isRefetch && currentIndex > 0) {
        // Get priority items (partner's watchlist) that we don't have yet
        const priorityItems = queueItems.filter(
          (item: { source: string }) => item.source === 'priority'
        );
        if (priorityItems.length > 0) {
          // Inject priority items after current position
          const { injectPartnerLike } = useQueueStore.getState();
          priorityItems.forEach((item: { movie: Movie }) => {
            injectPartnerLike(item.movie);
          });
        }
      } else {
        initializeQueue(roomCode, userSlot, queueItems, data.meta);
      }

      // Also set movies for fallback/match display
      setMovies(queueItems.map((item: { movie: Movie }) => item.movie));
    } catch (err) {
      console.error('Queue API error, falling back to movies API:', err);

      // Fallback to old API if queue API fails (only on initial load)
      if (!isRefetch) {
        try {
          const response = await fetch(`/api/movies?seed=${moviePoolSeed}`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch movies');
          }

          setMovies(data.movies);
        } catch (fallbackErr) {
          setError(
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Failed to load movies'
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [moviePoolSeed, userSlot, roomCode, initializeQueue, currentIndex]);

  // Fetch more movies when approaching end of queue
  const fetchMoreMovies = useCallback(async () => {
    if (!userSlot || !queueMeta?.hasMore) return;

    setFetchingMore(true);
    try {
      const offset = queue.length;
      const response = await fetch(
        `/api/rooms/${roomCode}/queue?userSlot=${userSlot}&limit=${FETCH_MORE_LIMIT}&offset=${offset}`
      );
      const data = await response.json();

      if (response.ok && data.movies?.length > 0) {
        const newItems = data.movies.map(
          (item: { movie: Movie; source: string }) => ({
            movie: item.movie,
            source: item.source,
          })
        );
        appendMovies(newItems, data.meta);
      }
    } catch (err) {
      console.error('Failed to fetch more movies:', err);
    } finally {
      setFetchingMore(false);
    }
  }, [userSlot, roomCode, queue.length, queueMeta?.hasMore, appendMovies, setFetchingMore]);

  // Initial queue fetch
  useEffect(() => {
    if (!moviePoolSeed || !userSlot) {
      router.push(`/${locale}`);
      return;
    }

    fetchQueue();
  }, [moviePoolSeed, userSlot, locale, router, fetchQueue]);

  // Refetch queue when partner joins with watchlist
  useEffect(() => {
    if (partnerHasWatchlist && !hasRefetchedForPartner.current) {
      hasRefetchedForPartner.current = true;
      fetchQueue(true);
      // Reset the flag after refetch so it doesn't trigger again
      setPartnerHasWatchlist(false);
    }
  }, [partnerHasWatchlist, fetchQueue, setPartnerHasWatchlist]);

  // Lazy load more movies when approaching end of queue
  useEffect(() => {
    if (shouldFetchMore) {
      fetchMoreMovies();
    }
  }, [shouldFetchMore, fetchMoreMovies]);

  // Find matched movie from queue or movies array
  const matchedMovie =
    queue.find((item) => item.movie.tmdbId === matchedMovieId)?.movie ||
    movies.find((m) => m.tmdbId === matchedMovieId);

  // Fetch matched movie if not found in local queue (for instant match scenario)
  useEffect(() => {
    if (isMatchFound && matchedMovieId && !matchedMovie && !fetchedMatchMovie) {
      fetch(`/api/movies/${matchedMovieId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.movie) {
            setFetchedMatchMovie(data.movie);
          }
        })
        .catch((err) => console.error('Failed to fetch matched movie:', err));
    }
  }, [isMatchFound, matchedMovieId, matchedMovie, fetchedMatchMovie]);

  // Combined movie for match display
  const displayMatchMovie = matchedMovie || fetchedMatchMovie;

  // Handle leave room
  const handleLeaveRoom = () => {
    disconnect();
    resetRoom();
    resetSwipe();
    resetQueue();
    router.push(`/${locale}`);
  };

  // Show match found screen
  if (isMatchFound && displayMatchMovie) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <MatchFound movie={displayMatchMovie} />
        <button
          onClick={handleLeaveRoom}
          className="mt-8 px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {t('common.backToHome')}
        </button>
      </div>
    );
  }

  // Show loading while fetching matched movie
  if (isMatchFound && !displayMatchMovie) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Loader size="lg" />
        <p className="mt-4 text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Loader size="lg" />
        <p className="mt-4 text-gray-500">{t('common.loading')}</p>
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
        <p className="mt-4 text-gray-500">{t('room.connecting')}</p>
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
      {(queue.length > 0 || movies.length > 0) && userSlot && (
        <MovieStack movies={movies} roomCode={roomCode} userSlot={userSlot} />
      )}
    </div>
  );
}
