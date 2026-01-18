'use client';

import { useEffect, useRef } from 'react';
import { useIsAuthenticated, useAuthToken } from '@/stores/authStore';
import { useSwipeStore } from '@/stores/swipeStore';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

/**
 * Hook that syncs locally stored likes to the server after user authenticates.
 * Should be used in a component that's mounted throughout the auth flow.
 */
export function useSyncLikesOnAuth() {
  const t = useTranslations('auth');
  const isAuthenticated = useIsAuthenticated();
  const token = useAuthToken();
  const wasAuthenticated = useRef(false);
  const isSyncing = useRef(false);

  const likedMoviesDetails = useSwipeStore((state) => state.likedMoviesDetails);
  const clearLikedMoviesDetails = useSwipeStore((state) => state.clearLikedMoviesDetails);
  const clearAnonymousSwipes = useSwipeStore((state) => state.clearAnonymousSwipes);

  useEffect(() => {
    // Detect authentication transition: false -> true
    if (!wasAuthenticated.current && isAuthenticated && token && !isSyncing.current) {
      const syncLikes = async () => {
        if (likedMoviesDetails.length === 0) {
          wasAuthenticated.current = true;
          return;
        }

        isSyncing.current = true;

        try {
          const items = likedMoviesDetails.map((movie) => ({
            tmdbId: movie.tmdbId,
            mediaType: movie.mediaType,
            status: 'want_to_watch' as const,
          }));

          const response = await fetch('/api/lists/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items }),
          });

          if (response.ok) {
            const result = await response.json();
            const addedCount = result.added || 0;

            if (addedCount > 0) {
              toast.success(
                t('syncSuccess', {
                  count: addedCount,
                  defaultValue: `Saved ${addedCount} movies to your list`,
                })
              );
            }

            // Clear local storage after successful sync
            clearLikedMoviesDetails();
            clearAnonymousSwipes();
          }
        } catch (error) {
          console.error('Failed to sync likes:', error);
          // Don't clear on error - user can try again
        } finally {
          isSyncing.current = false;
        }
      };

      syncLikes();
    }

    wasAuthenticated.current = isAuthenticated;
  }, [
    isAuthenticated,
    token,
    likedMoviesDetails,
    clearLikedMoviesDetails,
    clearAnonymousSwipes,
    t,
  ]);
}
