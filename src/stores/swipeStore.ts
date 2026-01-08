'use client';

import { create } from 'zustand';

interface SwipeState {
  currentIndex: number;
  swipedMovieIds: number[];
  likedMovieIds: number[];

  incrementIndex: () => void;
  addSwipe: (movieId: number, liked: boolean) => void;
  reset: () => void;
}

export const useSwipeStore = create<SwipeState>((set) => ({
  currentIndex: 0,
  swipedMovieIds: [],
  likedMovieIds: [],

  incrementIndex: () =>
    set((state) => ({
      currentIndex: state.currentIndex + 1,
    })),

  addSwipe: (movieId, liked) =>
    set((state) => ({
      swipedMovieIds: [...state.swipedMovieIds, movieId],
      likedMovieIds: liked
        ? [...state.likedMovieIds, movieId]
        : state.likedMovieIds,
    })),

  reset: () =>
    set({
      currentIndex: 0,
      swipedMovieIds: [],
      likedMovieIds: [],
    }),
}));
