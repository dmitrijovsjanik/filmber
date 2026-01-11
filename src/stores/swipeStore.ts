'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AnonymousSwipe {
  movieId: number;
  action: 'like' | 'skip';
  timestamp: number;
}

interface SwipeState {
  // Note: currentIndex is now managed by queueStore
  swipedMovieIds: number[];
  likedMovieIds: number[];

  // Anonymous swipes for import after login
  anonymousSwipes: AnonymousSwipe[];

  addSwipe: (movieId: number, liked: boolean) => void;
  hasSwipedMovie: (movieId: number) => boolean;
  hasLikedMovie: (movieId: number) => boolean;
  reset: () => void;

  // Anonymous swipe management
  getAnonymousSwipes: () => AnonymousSwipe[];
  clearAnonymousSwipes: () => void;
}

export const useSwipeStore = create<SwipeState>()(
  persist(
    (set, get) => ({
      swipedMovieIds: [],
      likedMovieIds: [],
      anonymousSwipes: [],

      addSwipe: (movieId, liked) =>
        set((state) => ({
          swipedMovieIds: [...state.swipedMovieIds, movieId],
          likedMovieIds: liked ? [...state.likedMovieIds, movieId] : state.likedMovieIds,
          // Also track for anonymous import
          anonymousSwipes: [
            ...state.anonymousSwipes,
            {
              movieId,
              action: liked ? 'like' : 'skip',
              timestamp: Date.now(),
            },
          ],
        })),

      hasSwipedMovie: (movieId) => get().swipedMovieIds.includes(movieId),

      hasLikedMovie: (movieId) => get().likedMovieIds.includes(movieId),

      reset: () =>
        set({
          swipedMovieIds: [],
          likedMovieIds: [],
          // Keep anonymousSwipes for potential import
        }),

      getAnonymousSwipes: () => get().anonymousSwipes,

      clearAnonymousSwipes: () =>
        set({
          anonymousSwipes: [],
        }),
    }),
    {
      name: 'filmber-swipes',
      // Only persist anonymous swipes and liked movies
      partialize: (state) => ({
        anonymousSwipes: state.anonymousSwipes,
        likedMovieIds: state.likedMovieIds,
      }),
    }
  )
);

// Selector for anonymous swipe count
export const useAnonymousSwipeCount = () => useSwipeStore((state) => state.anonymousSwipes.length);
export const useLikedMovieCount = () => useSwipeStore((state) => state.likedMovieIds.length);
export const useSwipedMovieIds = () => useSwipeStore((state) => state.swipedMovieIds);
