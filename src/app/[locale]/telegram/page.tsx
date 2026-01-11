'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useAuth } from '@/hooks/useAuth';
import { useRoomStore } from '@/stores/roomStore';
import { Loader } from '@/components/ui/Loader';
import { H4, Muted } from '@/components/ui/typography';

// Parse room params from startapp parameter (format: room_{code}_{pin})
function parseRoomParam(startParam?: string): { code: string; pin: string } | null {
  if (!startParam) return null;
  const match = startParam.match(/^room_([A-Z0-9]+)_(\d+)$/i);
  if (!match) return null;
  return { code: match[1].toUpperCase(), pin: match[2] };
}

export default function TelegramEntryPage() {
  const router = useRouter();
  const locale = useLocale();
  const { isTelegramMiniApp, initData, isReady, startParam } = useTelegramWebApp();
  const { authenticateWithTelegram, isAuthenticated, isLoading } = useAuth();
  const { setRoom } = useRoomStore();
  const [error, setError] = useState<string | null>(null);
  const [authAttempted, setAuthAttempted] = useState(false);
  const [roomJoinAttempted, setRoomJoinAttempted] = useState(false);

  // Handle room join after authentication
  useEffect(() => {
    if (!isReady || !isAuthenticated || roomJoinAttempted) return;

    const roomParams = parseRoomParam(startParam);
    if (!roomParams) {
      // No room param, just go home
      router.replace('/');
      return;
    }

    setRoomJoinAttempted(true);

    const joinRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomParams.code}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: roomParams.pin, viaLink: true }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to join room');
        }

        setRoom(roomParams.code, roomParams.pin, data.userSlot, data.moviePoolSeed);
        router.replace(`/${locale}/room/${roomParams.code}/swipe`);
      } catch (err) {
        console.error('Auto-join failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    };

    joinRoom();
  }, [isReady, isAuthenticated, startParam, roomJoinAttempted, locale, router, setRoom]);

  useEffect(() => {
    // Wait for Telegram WebApp to be ready
    if (!isReady) return;

    // If not in Telegram, redirect to home
    if (!isTelegramMiniApp) {
      router.replace('/');
      return;
    }

    // If already authenticated, let the room join effect handle redirect
    if (isAuthenticated) {
      return;
    }

    // If no initData, show error
    if (!initData) {
      setError('Could not get Telegram data. Please try again.');
      return;
    }

    // Attempt authentication once
    if (!authAttempted && !isLoading) {
      setAuthAttempted(true);
      authenticateWithTelegram(initData)
        .then((success) => {
          if (!success) {
            setError('Authentication failed. Please try again.');
          }
          // Room join will be handled by the other effect
        })
        .catch(() => {
          setError('An error occurred during authentication.');
        });
    }
  }, [
    isReady,
    isTelegramMiniApp,
    initData,
    isAuthenticated,
    isLoading,
    authAttempted,
    authenticateWithTelegram,
    router,
  ]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <H4 className="mb-2 text-foreground">Something went wrong</H4>
        <Muted className="mb-6">{error}</Muted>
        <button
          onClick={() => {
            setError(null);
            setAuthAttempted(false);
          }}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <Loader size="lg" />
      <Muted className="mt-4">
        {isLoading ? 'Signing you in...' : 'Loading...'}
      </Muted>
    </div>
  );
}
