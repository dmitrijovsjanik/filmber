'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChangelogRelease } from '@/lib/changelog/types';

interface ChangelogState {
  releases: ChangelogRelease[];
  isLoaded: boolean;
  isLoading: boolean;
  lastFetched: number | null;
  locale: string | null;
  hasHydrated: boolean;

  // Actions
  loadChangelog: (locale: string) => Promise<void>;
  reset: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours - changelog rarely changes

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      releases: [],
      isLoaded: false,
      isLoading: false,
      lastFetched: null,
      locale: null,
      hasHydrated: false,

      loadChangelog: async (locale: string) => {
        const state = get();
        if (state.isLoading) return;

        // If cache is valid and same locale, skip fetch
        const isCacheValid =
          state.lastFetched &&
          Date.now() - state.lastFetched < CACHE_TTL &&
          state.locale === locale;

        if (state.isLoaded && isCacheValid) {
          return;
        }

        set({ isLoading: true });

        try {
          const response = await fetch(`/api/changelog?locale=${locale}`);

          if (!response.ok) {
            set({ releases: [], isLoaded: true, isLoading: false, lastFetched: Date.now(), locale });
            return;
          }

          const data = await response.json();
          set({
            releases: data,
            isLoaded: true,
            isLoading: false,
            lastFetched: Date.now(),
            locale,
          });
        } catch (error) {
          console.error('Failed to load changelog:', error);
          set({ releases: [], isLoaded: true, isLoading: false });
        }
      },

      reset: () => {
        set({ releases: [], isLoaded: false, isLoading: false, lastFetched: null, locale: null });
      },

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'filmber-changelog',
      partialize: (state) => ({
        releases: state.releases,
        lastFetched: state.lastFetched,
        locale: state.locale,
        isLoaded: state.isLoaded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selectors
export const useChangelogReleases = () => useChangelogStore((state) => state.releases);
export const useChangelogLoaded = () => useChangelogStore((state) => state.isLoaded);
export const useChangelogLoading = () => useChangelogStore((state) => state.isLoading);
export const useChangelogHydrated = () => useChangelogStore((state) => state.hasHydrated);
