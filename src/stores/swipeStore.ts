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

  // Hydration state
  hasHydrated: boolean;

  addSwipe: (movieId: number, liked: boolean) => void;
  hasSwipedMovie: (movieId: number) => boolean;
  hasLikedMovie: (movieId: number) => boolean;
  reset: () => void;
  setHasHydrated: (hydrated: boolean) => void;

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
      hasHydrated: false,

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

      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      getAnonymousSwipes: () => get().anonymousSwipes,

      clearAnonymousSwipes: () =>
        set({
          anonymousSwipes: [],
        }),
    }),
    {
      name: 'filmber-swipes',
      // Persist swipe progress for session restoration
      partialize: (state) => ({
        swipedMovieIds: state.swipedMovieIds,
        likedMovieIds: state.likedMovieIds,
        anonymousSwipes: state.anonymousSwipes,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selectors
export const useAnonymousSwipeCount = () => useSwipeStore((state) => state.anonymousSwipes.length);
export const useLikedMovieCount = () => useSwipeStore((state) => state.likedMovieIds.length);
export const useSwipedMovieIds = () => useSwipeStore((state) => state.swipedMovieIds);
export const useSwipeStoreHydrated = () => useSwipeStore((state) => state.hasHydrated);
