'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConsentState {
  analyticsConsent: boolean | null; // null = not decided yet
  consentTimestamp: number | null;

  setAnalyticsConsent: (consent: boolean) => void;
  hasDecided: () => boolean;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      analyticsConsent: null,
      consentTimestamp: null,

      setAnalyticsConsent: (consent: boolean) =>
        set({
          analyticsConsent: consent,
          consentTimestamp: Date.now(),
        }),

      hasDecided: () => get().analyticsConsent !== null,
    }),
    {
      name: 'filmber-consent',
    }
  )
);
