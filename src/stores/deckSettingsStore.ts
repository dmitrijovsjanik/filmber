'use client';

import { create } from 'zustand';

export interface DeckSettings {
  showWatchedMovies: boolean;
}

interface DeckSettingsState extends DeckSettings {
  isLoaded: boolean;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<DeckSettings>) => Promise<void>;
  reset: () => void;
}

const defaultSettings: DeckSettings = {
  showWatchedMovies: false,
};

export const useDeckSettingsStore = create<DeckSettingsState>()((set, get) => ({
  ...defaultSettings,
  isLoaded: false,
  isLoading: false,

  loadSettings: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });

    try {
      const response = await fetch('/api/settings/deck', {
        credentials: 'include',
      });

      if (!response.ok) {
        // If unauthorized or error, use default settings
        set({ ...defaultSettings, isLoaded: true, isLoading: false });
        return;
      }

      const data = await response.json();
      set({
        showWatchedMovies: data.showWatchedMovies ?? false,
        isLoaded: true,
        isLoading: false,
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
          isLoading: false,
        });
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      set({
        showWatchedMovies: data.showWatchedMovies ?? false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to update deck settings:', error);
      // Revert on error
      set({
        showWatchedMovies: previousState.showWatchedMovies,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set({ ...defaultSettings, isLoaded: false, isLoading: false });
  },
}));

// Selectors
export const useShowWatchedMovies = () =>
  useDeckSettingsStore((state) => state.showWatchedMovies);
export const useDeckSettingsLoaded = () =>
  useDeckSettingsStore((state) => state.isLoaded);
