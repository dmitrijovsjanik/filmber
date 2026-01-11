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

  // Social tracking
  const trackShareRoom = useCallback(() => {
    track(YM_EVENTS.SHARE_ROOM_CLICK);
  }, [track]);

  const trackReferralInvite = useCallback(() => {
    track(YM_EVENTS.REFERRAL_INVITE_CLICK);
  }, [track]);

  const trackNotificationsToggle = useCallback(
    (enabled: boolean) => {
      track(YM_EVENTS.NOTIFICATIONS_TOGGLE, { enabled });
    },
    [track]
  );

  // Movie tracking
  const trackMovieAddedToWatchlist = useCallback(
    (movieId: number) => {
      track(YM_EVENTS.MOVIE_ADDED_TO_WATCHLIST, { movieId });
    },
    [track]
  );

  const trackMovieDetailsOpened = useCallback(
    (movieId: number) => {
      track(YM_EVENTS.MOVIE_DETAILS_OPENED, { movieId });
    },
    [track]
  );

  const trackMovieRated = useCallback(
    (movieId: number, rating: number) => {
      track(YM_EVENTS.MOVIE_RATED, { movieId, rating });
    },
    [track]
  );

  const trackMovieRemoved = useCallback(
    (movieId: number) => {
      track(YM_EVENTS.MOVIE_REMOVED, { movieId });
    },
    [track]
  );

  const trackListFilterChanged = useCallback(
    (filter: string, value: string | number | null) => {
      track(YM_EVENTS.LIST_FILTER_CHANGED, { filter, value });
    },
    [track]
  );

  const trackListSearchUsed = useCallback(() => {
    track(YM_EVENTS.LIST_SEARCH_USED);
  }, [track]);

  return {
    track,
    trackRoomCreated,
    trackRoomJoined,
    trackSwipe,
    trackMatchFound,
    // Social
    trackShareRoom,
    trackReferralInvite,
    trackNotificationsToggle,
    // Movie
    trackMovieAddedToWatchlist,
    trackMovieDetailsOpened,
    trackMovieRated,
    trackMovieRemoved,
    trackListFilterChanged,
    trackListSearchUsed,
  };
}
