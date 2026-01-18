'use client';

import { useEffect, useRef } from 'react';
import { useIsAuthenticated, useAuthToken } from '@/stores/authStore';
import { useSwipeStore } from '@/stores/swipeStore';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

/**
 * Hook that syncs pending rating to the server after user authenticates.
 * Should be used in a component that's mounted throughout the auth flow.
 */
export function useSyncPendingRatingOnAuth() {
  const t = useTranslations('lists');
  const isAuthenticated = useIsAuthenticated();
  const token = useAuthToken();
  const wasAuthenticated = useRef(false);
  const isSyncing = useRef(false);

  const pendingRating = useSwipeStore((state) => state.pendingRating);
  const clearPendingRating = useSwipeStore((state) => state.clearPendingRating);

  useEffect(() => {
    // Detect authentication transition: false -> true
    if (!wasAuthenticated.current && isAuthenticated && token && !isSyncing.current) {
      const syncPendingRating = async () => {
        if (!pendingRating) {
          wasAuthenticated.current = true;
          return;
        }

        // Check if rating is not too old (max 1 hour)
        const ONE_HOUR = 60 * 60 * 1000;
        if (Date.now() - pendingRating.timestamp > ONE_HOUR) {
          clearPendingRating();
          wasAuthenticated.current = true;
          return;
        }

        isSyncing.current = true;

        try {
          // Add movie to list with rating
          const response = await fetch('/api/lists', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tmdbId: pendingRating.tmdbId,
              status: 'watched',
              rating: pendingRating.rating,
              source: 'manual',
              mediaType: pendingRating.mediaType,
            }),
          });

          if (response.ok) {
            toast.success(
              t('ratingSaved', {
                defaultValue: 'Your rating has been saved',
              })
            );
            clearPendingRating();
          }
        } catch (error) {
          console.error('Failed to sync pending rating:', error);
          // Clear anyway to avoid repeated attempts
          clearPendingRating();
        } finally {
          isSyncing.current = false;
        }
      };

      syncPendingRating();
    }

    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, token, pendingRating, clearPendingRating, t]);
}
