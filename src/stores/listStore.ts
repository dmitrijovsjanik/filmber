'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MovieStatus } from '@/lib/db/schema';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
  overview: string | null;
  overviewRu: string | null;
  imdbRating: string | null;
  rottenTomatoesRating: string | null;
  mediaType?: 'movie' | 'tv';
  originalLanguage?: string | null;
}

export interface ListItem {
  id: string;
  tmdbId: number;
  status: MovieStatus;
  rating: number | null;
  movie: MovieData | null;
  watchStartedAt: string | null;
}

interface FilterCounts {
  all: number;
  wantToWatch: number;
  watched: number;
  ratings: Record<number, number>;
}

interface ListCache {
  items: ListItem[];
  counts: FilterCounts;
  lastFetched: number;
}

interface ListState {
  // Cached data
  cache: ListCache | null;

  // Memoized lookup map for O(1) item access by tmdbId
  // Not persisted - rebuilt from cache on changes
  _tmdbIdMap: Map<number, ListItem>;

  // Cache settings
  cacheVersion: number;
  cacheTTL: number; // in milliseconds

  // Loading state
  isLoading: boolean;
  isFetching: boolean; // background refresh

  // Hydration
  hasHydrated: boolean;

  // Actions
  setCache: (items: ListItem[], counts: FilterCounts) => void;
  updateItem: (tmdbId: number, updates: Partial<ListItem>) => void;
  removeItem: (tmdbId: number) => void;
  addItem: (item: ListItem) => void;
  setLoading: (loading: boolean) => void;
  setFetching: (fetching: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;

  // Cache utilities
  isCacheValid: () => boolean;
  isCacheStale: () => boolean;
  invalidateCache: () => void;
  getCachedItems: () => ListItem[];
  getCachedCounts: () => FilterCounts | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 30 * 1000; // 30 seconds - show cached but refetch in background
const CACHE_VERSION = 1;

// Helper to build the tmdbId lookup map from items array
function buildTmdbIdMap(items: ListItem[]): Map<number, ListItem> {
  const map = new Map<number, ListItem>();
  for (const item of items) {
    map.set(item.tmdbId, item);
  }
  return map;
}

const defaultCounts: FilterCounts = {
  all: 0,
  wantToWatch: 0,
  watched: 0,
  ratings: { 1: 0, 2: 0, 3: 0 },
};

export const useListStore = create<ListState>()(
  persist(
    (set, get) => ({
      cache: null,
      _tmdbIdMap: new Map(),
      cacheVersion: CACHE_VERSION,
      cacheTTL: CACHE_TTL,
      isLoading: false,
      isFetching: false,
      hasHydrated: false,

      setCache: (items, counts) => {
        set({
          cache: {
            items,
            counts,
            lastFetched: Date.now(),
          },
          _tmdbIdMap: buildTmdbIdMap(items),
          isLoading: false,
          isFetching: false,
        });
      },

      updateItem: (tmdbId, updates) => {
        const { cache, _tmdbIdMap } = get();
        if (!cache) return;

        const updatedItems = cache.items.map((item) =>
          item.tmdbId === tmdbId ? { ...item, ...updates } : item
        );

        // Recalculate counts
        const counts = calculateCounts(updatedItems);

        // Update the map entry
        const existingItem = _tmdbIdMap.get(tmdbId);
        const newMap = new Map(_tmdbIdMap);
        if (existingItem) {
          newMap.set(tmdbId, { ...existingItem, ...updates });
        }

        set({
          cache: {
            ...cache,
            items: updatedItems,
            counts,
          },
          _tmdbIdMap: newMap,
        });
      },

      removeItem: (tmdbId) => {
        const { cache, _tmdbIdMap } = get();
        if (!cache) return;

        const updatedItems = cache.items.filter((item) => item.tmdbId !== tmdbId);
        const counts = calculateCounts(updatedItems);

        // Remove from map
        const newMap = new Map(_tmdbIdMap);
        newMap.delete(tmdbId);

        set({
          cache: {
            ...cache,
            items: updatedItems,
            counts,
          },
          _tmdbIdMap: newMap,
        });
      },

      addItem: (item) => {
        const { cache, _tmdbIdMap } = get();

        const currentItems = cache?.items || [];
        // Check if already exists
        if (_tmdbIdMap.has(item.tmdbId)) {
          return;
        }

        const updatedItems = [item, ...currentItems];
        const counts = calculateCounts(updatedItems);

        // Add to map
        const newMap = new Map(_tmdbIdMap);
        newMap.set(item.tmdbId, item);

        set({
          cache: {
            items: updatedItems,
            counts,
            lastFetched: cache?.lastFetched || Date.now(),
          },
          _tmdbIdMap: newMap,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setFetching: (isFetching) => set({ isFetching }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      isCacheValid: () => {
        const { cache, cacheVersion, cacheTTL } = get();
        if (!cache) return false;
        if (cacheVersion !== CACHE_VERSION) return false;

        const age = Date.now() - cache.lastFetched;
        return age < cacheTTL;
      },

      isCacheStale: () => {
        const { cache } = get();
        if (!cache) return true;

        const age = Date.now() - cache.lastFetched;
        return age > STALE_TTL;
      },

      invalidateCache: () => {
        set({ cache: null, _tmdbIdMap: new Map() });
      },

      getCachedItems: () => {
        const { cache } = get();
        return cache?.items || [];
      },

      getCachedCounts: () => {
        const { cache } = get();
        return cache?.counts || null;
      },
    }),
    {
      name: 'filmber-list',
      version: CACHE_VERSION,
      partialize: (state) => ({
        cache: state.cache,
        cacheVersion: state.cacheVersion,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error && state) {
          // Rebuild the lookup map from persisted cache
          if (state.cache?.items) {
            state._tmdbIdMap = buildTmdbIdMap(state.cache.items);
          }
          state.setHasHydrated(true);
        }
      },
      migrate: (persistedState, version) => {
        // Handle version migrations
        if (version < CACHE_VERSION) {
          // Clear cache on version bump
          const state = persistedState as Partial<ListState>;
          return {
            ...state,
            cache: null,
            cacheVersion: CACHE_VERSION,
          };
        }
        return persistedState as ListState;
      },
    }
  )
);

// Helper function to calculate counts from items
function calculateCounts(items: ListItem[]): FilterCounts {
  const counts: FilterCounts = {
    all: items.length,
    wantToWatch: 0,
    watched: 0,
    ratings: { 1: 0, 2: 0, 3: 0 },
  };

  for (const item of items) {
    if (item.status === 'want_to_watch') {
      counts.wantToWatch++;
    } else if (item.status === 'watched') {
      counts.watched++;
    }

    if (item.rating !== null && item.rating >= 1 && item.rating <= 3) {
      counts.ratings[item.rating]++;
    }
  }

  return counts;
}

// Selectors
export const useListCache = () => useListStore((state) => state.cache);
export const useListItems = () => useListStore((state) => state.cache?.items || []);
export const useListCounts = () => useListStore((state) => state.cache?.counts || defaultCounts);
export const useListLoading = () => useListStore((state) => state.isLoading);
export const useListFetching = () => useListStore((state) => state.isFetching);
export const useListHasHydrated = () => useListStore((state) => state.hasHydrated);

// Find item by tmdbId - O(1) lookup using memoized map
export const useListItemByTmdbId = (tmdbId: number) =>
  useListStore((state) => state._tmdbIdMap.get(tmdbId) ?? null);
