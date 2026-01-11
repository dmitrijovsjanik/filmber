'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
}

interface ReferralState {
  // Cached data
  stats: ReferralStats | null;
  lastFetched: number | null;

  // Loading state
  isLoading: boolean;
  hasHydrated: boolean;

  // Actions
  setStats: (stats: ReferralStats) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
  isCacheValid: () => boolean;
  invalidateCache: () => void;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - referral data changes rarely

export const useReferralStore = create<ReferralState>()(
  persist(
    (set, get) => ({
      stats: null,
      lastFetched: null,
      isLoading: false,
      hasHydrated: false,

      setStats: (stats) => {
        set({
          stats,
          lastFetched: Date.now(),
          isLoading: false,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      isCacheValid: () => {
        const { stats, lastFetched } = get();
        if (!stats || !lastFetched) return false;
        return Date.now() - lastFetched < CACHE_TTL;
      },

      invalidateCache: () => {
        set({ stats: null, lastFetched: null });
      },
    }),
    {
      name: 'filmber-referral',
      partialize: (state) => ({
        stats: state.stats,
        lastFetched: state.lastFetched,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selectors
export const useReferralStats = () => useReferralStore((state) => state.stats);
export const useReferralLoading = () => useReferralStore((state) => state.isLoading);
export const useReferralHasHydrated = () => useReferralStore((state) => state.hasHydrated);
