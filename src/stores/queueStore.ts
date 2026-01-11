'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Movie } from '@/types/movie';

export type QueueItemSource = 'priority' | 'base' | 'partner_like';

export interface QueueItem {
  movie: Movie;
  source: QueueItemSource;
}

interface QueueMeta {
  priorityQueueRemaining: number;
  basePoolRemaining: number;
  totalRemaining: number;
  hasMore: boolean;
}

interface QueueState {
  // Queue data
  queue: QueueItem[];
  currentIndex: number;
  meta: QueueMeta | null;

  // Room context
  roomCode: string | null;
  userSlot: 'A' | 'B' | null;

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initializeQueue: (
    roomCode: string,
    userSlot: 'A' | 'B',
    items: QueueItem[],
    meta: QueueMeta
  ) => void;
  injectPartnerLike: (movie: Movie) => void;
  consumeNext: () => void;
  appendMovies: (items: QueueItem[], meta: QueueMeta) => void;
  setLoading: (loading: boolean) => void;
  getCurrentMovie: () => QueueItem | null;
  getVisibleMovies: (count?: number) => QueueItem[];
  reset: () => void;
}

const initialState = {
  queue: [],
  currentIndex: 0,
  meta: null,
  roomCode: null,
  userSlot: null,
  isLoading: false,
  isInitialized: false,
};

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      ...initialState,

      initializeQueue: (roomCode, userSlot, items, meta) => {
        set({
          roomCode,
          userSlot,
          queue: items,
          currentIndex: 0,
          meta,
          isInitialized: true,
          isLoading: false,
        });
      },

      injectPartnerLike: (movie) => {
        const { queue, currentIndex } = get();

        // Check if movie is already in queue or already swiped
        const isInQueue = queue.some((item) => item.movie.tmdbId === movie.tmdbId);
        if (isInQueue) return;

        // Insert right after the current position
        const newQueue = [...queue];
        const insertIndex = currentIndex + 1;
        newQueue.splice(insertIndex, 0, { movie, source: 'partner_like' });

        set({ queue: newQueue });
      },

      consumeNext: () => {
        set((state) => ({
          currentIndex: state.currentIndex + 1,
        }));
      },

      appendMovies: (items, meta) => {
        set((state) => ({
          queue: [...state.queue, ...items],
          meta,
        }));
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      getCurrentMovie: () => {
        const { queue, currentIndex } = get();
        return queue[currentIndex] ?? null;
      },

      getVisibleMovies: (count = 3) => {
        const { queue, currentIndex } = get();
        return queue.slice(currentIndex, currentIndex + count);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'filmber-queue',
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        roomCode: state.roomCode,
        userSlot: state.userSlot,
        isInitialized: state.isInitialized,
      }),
    }
  )
);

// Selectors
export const useCurrentIndex = () => useQueueStore((state) => state.currentIndex);
export const useQueueLength = () => useQueueStore((state) => state.queue.length);
export const useRemainingCount = () =>
  useQueueStore((state) => state.queue.length - state.currentIndex);
export const useIsQueueLoading = () => useQueueStore((state) => state.isLoading);
export const useIsQueueInitialized = () => useQueueStore((state) => state.isInitialized);
