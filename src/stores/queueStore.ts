'use client';

import { create } from 'zustand';
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
  isFetchingMore: boolean;

  // Animation lock - prevents queue mutations during card animations
  isAnimating: boolean;
  pendingPartnerLikes: Movie[];

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
  setFetchingMore: (fetching: boolean) => void;
  setAnimating: (animating: boolean) => void;
  processPendingLikes: () => void;
  getCurrentMovie: () => QueueItem | null;
  getVisibleMovies: (count?: number) => QueueItem[];
  shouldFetchMore: () => boolean;
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
  isFetchingMore: false,
  isAnimating: false,
  pendingPartnerLikes: [] as Movie[],
};

// Threshold: fetch more when remaining items drops below this
const FETCH_MORE_THRESHOLD = 5;

export const useQueueStore = create<QueueState>()((set, get) => ({
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
        // Validate movie object
        if (!movie || typeof movie.tmdbId !== 'number') {
          console.error('[QUEUE] injectPartnerLike: invalid movie object', movie);
          return;
        }

        const { queue, currentIndex, isAnimating, pendingPartnerLikes } = get();
        console.log('[QUEUE] injectPartnerLike called', {
          movieId: movie.tmdbId,
          isAnimating,
          currentIndex,
          queueLength: queue.length,
          pendingCount: pendingPartnerLikes.length,
          timestamp: Date.now()
        });

        // Check if movie is already in queue, pending, or already swiped
        const isInQueue = queue.some((item) => item.movie?.tmdbId === movie.tmdbId);
        const isPending = pendingPartnerLikes.some((m) => m.tmdbId === movie.tmdbId);
        if (isInQueue || isPending) {
          console.log('[QUEUE] injectPartnerLike skipped - already exists', { isInQueue, isPending });
          return;
        }

        // If animation is in progress, defer the injection to avoid visual glitches
        if (isAnimating) {
          console.log('[QUEUE] injectPartnerLike DEFERRED (animation in progress)', { movieId: movie.tmdbId });
          set({ pendingPartnerLikes: [...pendingPartnerLikes, movie] });
          return;
        }

        // Insert AFTER visible cards (3 cards shown) to avoid visual glitches
        // This ensures partner's likes don't cause sudden card shifts
        const newQueue = [...queue];
        const insertIndex = Math.min(currentIndex + 4, newQueue.length);
        newQueue.splice(insertIndex, 0, { movie, source: 'partner_like' });
        console.log('[QUEUE] injectPartnerLike INSERTED', { movieId: movie.tmdbId, insertIndex, newQueueLength: newQueue.length });

        set({ queue: newQueue });
      },

      consumeNext: () => {
        const { currentIndex, queue } = get();
        console.log('[QUEUE] consumeNext', {
          oldIndex: currentIndex,
          newIndex: currentIndex + 1,
          queueLength: queue.length,
          nextMovie: queue[currentIndex + 1]?.movie?.tmdbId,
          timestamp: Date.now()
        });
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

      setFetchingMore: (fetching) => {
        set({ isFetchingMore: fetching });
      },

      setAnimating: (animating) => {
        set({ isAnimating: animating });
      },

      processPendingLikes: () => {
        const { queue, currentIndex, pendingPartnerLikes } = get();
        if (pendingPartnerLikes.length === 0) return;

        const newQueue = [...queue];
        pendingPartnerLikes.forEach((movie) => {
          // Double-check movie isn't already in queue
          const isInQueue = newQueue.some((item) => item.movie?.tmdbId === movie.tmdbId);
          if (!isInQueue) {
            const insertIndex = Math.min(currentIndex + 4, newQueue.length);
            newQueue.splice(insertIndex, 0, { movie, source: 'partner_like' });
          }
        });

        set({ queue: newQueue, pendingPartnerLikes: [] });
      },

      getCurrentMovie: () => {
        const { queue, currentIndex } = get();
        return queue[currentIndex] ?? null;
      },

      getVisibleMovies: (count = 3) => {
        const { queue, currentIndex } = get();
        return queue.slice(currentIndex, currentIndex + count);
      },

      shouldFetchMore: () => {
        const { queue, currentIndex, meta, isFetchingMore } = get();
        if (isFetchingMore) return false;
        if (!meta?.hasMore) return false;

        const remaining = queue.length - currentIndex;
        return remaining <= FETCH_MORE_THRESHOLD;
      },

  reset: () => {
    set(initialState);
  },
}));

// Selectors
export const useCurrentIndex = () => useQueueStore((state) => state.currentIndex);
export const useQueueLength = () => useQueueStore((state) => state.queue.length);
export const useRemainingCount = () =>
  useQueueStore((state) => state.queue.length - state.currentIndex);
export const useIsQueueLoading = () => useQueueStore((state) => state.isLoading);
export const useIsQueueInitialized = () => useQueueStore((state) => state.isInitialized);
export const useIsFetchingMore = () => useQueueStore((state) => state.isFetchingMore);
export const useShouldFetchMore = () => useQueueStore((state) => state.shouldFetchMore());
export const useQueueMeta = () => useQueueStore((state) => state.meta);
