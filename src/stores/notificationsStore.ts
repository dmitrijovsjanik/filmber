'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationSettings {
  watchReminders: boolean;
}

interface NotificationsState extends NotificationSettings {
  isLoaded: boolean;
  isLoading: boolean;
  lastFetched: number | null;
  hasHydrated: boolean;

  // Actions
  loadSettings: (token: string) => Promise<void>;
  updateSettings: (token: string, settings: Partial<NotificationSettings>) => Promise<void>;
  reset: () => void;
  setHasHydrated: (hydrated: boolean) => void;
}

const defaultSettings: NotificationSettings = {
  watchReminders: true,
};

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      isLoaded: false,
      isLoading: false,
      lastFetched: null,
      hasHydrated: false,

      loadSettings: async (token: string) => {
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
          const response = await fetch('/api/notifications/settings', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            set({ ...defaultSettings, isLoaded: true, isLoading: false, lastFetched: Date.now() });
            return;
          }

          const data = await response.json();
          set({
            watchReminders: data.watchReminders ?? true,
            isLoaded: true,
            isLoading: false,
            lastFetched: Date.now(),
          });
        } catch (error) {
          console.error('Failed to load notification settings:', error);
          set({ ...defaultSettings, isLoaded: true, isLoading: false });
        }
      },

      updateSettings: async (token: string, settings: Partial<NotificationSettings>) => {
        const previousState = get();

        // Optimistic update
        set({ ...settings, isLoading: true });

        try {
          const response = await fetch('/api/notifications/settings', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(settings),
          });

          if (!response.ok) {
            // Revert on error
            set({
              watchReminders: previousState.watchReminders,
              isLoading: false,
            });
            throw new Error('Failed to update settings');
          }

          set({
            isLoading: false,
            lastFetched: Date.now(),
          });
        } catch (error) {
          console.error('Failed to update notification settings:', error);
          set({
            watchReminders: previousState.watchReminders,
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
      name: 'filmber-notifications',
      partialize: (state) => ({
        watchReminders: state.watchReminders,
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
export const useWatchReminders = () =>
  useNotificationsStore((state) => state.watchReminders);
export const useNotificationsLoaded = () =>
  useNotificationsStore((state) => state.isLoaded);
export const useNotificationsLoading = () =>
  useNotificationsStore((state) => state.isLoading);
export const useNotificationsHydrated = () =>
  useNotificationsStore((state) => state.hasHydrated);
