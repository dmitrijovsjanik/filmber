'use client';

import { useEffect, useState } from 'react';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useAuth } from '@/hooks/useAuth';
import { useSyncLikesOnAuth } from '@/hooks/useSyncLikesOnAuth';
import { useSyncPendingRatingOnAuth } from '@/hooks/useSyncPendingRatingOnAuth';

interface TelegramAuthProviderProps {
  children: React.ReactNode;
}

export function TelegramAuthProvider({ children }: TelegramAuthProviderProps) {
  const { isTelegramMiniApp, initData, isReady } = useTelegramWebApp();
  const { authenticateWithTelegram, isAuthenticated, isInitialized } = useAuth();
  const [authAttempted, setAuthAttempted] = useState(false);

  // Sync locally stored likes and pending rating when user authenticates
  useSyncLikesOnAuth();
  useSyncPendingRatingOnAuth();

  useEffect(() => {
    // Only attempt auth once, when we're in Telegram Mini App and have initData
    if (
      isTelegramMiniApp &&
      isReady &&
      initData &&
      !isAuthenticated &&
      isInitialized &&
      !authAttempted
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthAttempted(true);
      authenticateWithTelegram(initData).catch((error) => {
        console.error('Auto-auth failed:', error);
      });
    }
  }, [
    isTelegramMiniApp,
    isReady,
    initData,
    isAuthenticated,
    isInitialized,
    authAttempted,
    authenticateWithTelegram,
  ]);

  return <>{children}</>;
}
