'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AnonymousSwipe {
  movieId: number;
  action: 'like' | 'skip';
  timestamp: number;
}

interface LikedMovieDetails {
  tmdbId: number;
  posterPath: string | null;
  title: string;
  mediaType: 'movie' | 'tv';
}

interface SwipeState {
  // Note: currentIndex is now managed by queueStore
  swipedMovieIds: number[];
  likedMovieIds: number[];

  // Details of liked movies for displaying in auth prompt
  likedMoviesDetails: LikedMovieDetails[];

  // Anonymous swipes for import after login
  anonymousSwipes: AnonymousSwipe[];

  // Hydration state
  hasHydrated: boolean;

  addSwipe: (movieId: number, liked: boolean) => void;
  addLikedMovieDetails: (movie: LikedMovieDetails) => void;
  hasSwipedMovie: (movieId: number) => boolean;
  hasLikedMovie: (movieId: number) => boolean;
  getLikedMoviesDetails: () => LikedMovieDetails[];
  reset: () => void;
  setHasHydrated: (hydrated: boolean) => void;

  // Anonymous swipe management
  getAnonymousSwipes: () => AnonymousSwipe[];
  clearAnonymousSwipes: () => void;
  clearLikedMoviesDetails: () => void;
}

export const useSwipeStore = create<SwipeState>()(
  persist(
    (set, get) => ({
      swipedMovieIds: [],
      likedMovieIds: [],
      likedMoviesDetails: [],
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

      addLikedMovieDetails: (movie) =>
        set((state) => {
          // Avoid duplicates
          if (state.likedMoviesDetails.some((m) => m.tmdbId === movie.tmdbId)) {
            return state;
          }
          return {
            likedMoviesDetails: [...state.likedMoviesDetails, movie],
          };
        }),

      hasSwipedMovie: (movieId) => get().swipedMovieIds.includes(movieId),

      hasLikedMovie: (movieId) => get().likedMovieIds.includes(movieId),

      getLikedMoviesDetails: () => get().likedMoviesDetails,

      reset: () =>
        set({
          swipedMovieIds: [],
          likedMovieIds: [],
          // Keep anonymousSwipes and likedMoviesDetails for potential import
        }),

      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      getAnonymousSwipes: () => get().anonymousSwipes,

      clearAnonymousSwipes: () =>
        set({
          anonymousSwipes: [],
        }),

      clearLikedMoviesDetails: () =>
        set({
          likedMoviesDetails: [],
        }),
    }),
    {
      name: 'filmber-swipes',
      // Persist swipe progress for session restoration
      partialize: (state) => ({
        swipedMovieIds: state.swipedMovieIds,
        likedMovieIds: state.likedMovieIds,
        likedMoviesDetails: state.likedMoviesDetails,
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
export const useLikedMoviesDetails = () => useSwipeStore((state) => state.likedMoviesDetails);

// Export type for use in components
export type { LikedMovieDetails };
