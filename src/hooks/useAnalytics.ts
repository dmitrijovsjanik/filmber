'use client';

import { useCallback } from 'react';
import { useConsentStore } from '@/stores/consentStore';
import { trackEvent, YM_EVENTS } from '@/lib/analytics/yandexMetrica';

export function useAnalytics() {
  const { analyticsConsent } = useConsentStore();

  const track = useCallback(
    (eventName: string, params?: Record<string, unknown>) => {
      if (analyticsConsent) {
        trackEvent(eventName, params);
      }
    },
    [analyticsConsent]
  );

  const trackRoomCreated = useCallback(
    (mode: 'solo' | 'pair') => {
      track(mode === 'solo' ? YM_EVENTS.SOLO_MODE_STARTED : YM_EVENTS.ROOM_CREATED);
    },
    [track]
  );

  const trackRoomJoined = useCallback(() => {
    track(YM_EVENTS.ROOM_JOINED);
  }, [track]);

  const trackSwipe = useCallback(
    (direction: 'left' | 'right', movieId: number) => {
      track(direction === 'right' ? YM_EVENTS.SWIPE_LIKE : YM_EVENTS.SWIPE_SKIP, {
        movieId,
      });
    },
    [track]
  );

  const trackMatchFound = useCallback(
    (movieId: number) => {
      track(YM_EVENTS.MATCH_FOUND, { movieId });
    },
    [track]
  );

  return {
    track,
    trackRoomCreated,
    trackRoomJoined,
    trackSwipe,
    trackMatchFound,
  };
}
