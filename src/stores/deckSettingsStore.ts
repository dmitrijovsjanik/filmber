'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaTypeFilter } from '@/types/movie';

export interface DeckSettings {
  showWatchedMovies: boolean;
  mediaTypeFilter: MediaTypeFilter;
}

interface DeckSettingsState extends DeckSettings {
  isLoaded: boolean;
  isLoading: boolean;
  lastFetched: number | null;
  hasHydrated: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<DeckSettings>) => Promise<void>;
  reset: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const defaultSettings: DeckSettings = {
  showWatchedMovies: false,
  mediaTypeFilter: 'all',
};

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const useDeckSettingsStore = create<DeckSettingsState>()(
  persist(
    (set, get) => ({
  ...defaultSettings,
  isLoaded: false,
  isLoading: false,
  lastFetched: null,
  hasHydrated: false,

  loadSettings: async () => {
    const state = get();
    if (state.isLoading) return;

    // If cache is still valid, skip fetch
    const isCacheValid =
      state.lastFetched && Date.now() - state.lastFetched < CACHE_TTL;

    if (state.isLoaded && isCacheValid) {
      return;
    }

    set({ isLoading: true });

    try {
      const response = await fetch('/api/settings/deck', {
        credentials: 'include',
      });

      if (!response.ok) {
        // If unauthorized or error, use default settings
        set({ ...defaultSettings, isLoaded: true, isLoading: false, lastFetched: Date.now() });
        return;
      }

      const data = await response.json();
      set({
        showWatchedMovies: data.showWatchedMovies ?? false,
        mediaTypeFilter: data.mediaTypeFilter ?? 'all',
        isLoaded: true,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      console.error('Failed to load deck settings:', error);
      set({ ...defaultSettings, isLoaded: true, isLoading: false });
    }
  },

  updateSettings: async (settings) => {
    const previousState = get();

    // Optimistic update
    set({ ...settings, isLoading: true });

    try {
      const response = await fetch('/api/settings/deck', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        // Revert on error
        set({
          showWatchedMovies: previousState.showWatchedMovies,
          mediaTypeFilter: previousState.mediaTypeFilter,
          isLoading: false,
        });
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      set({
        showWatchedMovies: data.showWatchedMovies ?? false,
        mediaTypeFilter: data.mediaTypeFilter ?? 'all',
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      console.error('Failed to update deck settings:', error);
      // Revert on error
      set({
        showWatchedMovies: previousState.showWatchedMovies,
        mediaTypeFilter: previousState.mediaTypeFilter,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ ...defaultSettings, isLoaded: false, isLoading: false, lastFetched: null });
  },

  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'filmber-deck-settings',
      partialize: (state) => ({
        showWatchedMovies: state.showWatchedMovies,
        mediaTypeFilter: state.mediaTypeFilter,
        lastFetched: state.lastFetched,
        isLoaded: state.isLoaded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selectors
export const useShowWatchedMovies = () =>
  useDeckSettingsStore((state) => state.showWatchedMovies);
export const useMediaTypeFilter = () =>
  useDeckSettingsStore((state) => state.mediaTypeFilter);
export const useDeckSettingsLoaded = () =>
  useDeckSettingsStore((state) => state.isLoaded);
export const useDeckSettingsHydrated = () =>
  useDeckSettingsStore((state) => state.hasHydrated);
