'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from '@/components/ui/Loader';

export default function TelegramEntryPage() {
  const router = useRouter();
  const { isTelegramMiniApp, initData, isReady } = useTelegramWebApp();
  const { authenticateWithTelegram, isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [authAttempted, setAuthAttempted] = useState(false);

  useEffect(() => {
    // Wait for Telegram WebApp to be ready
    if (!isReady) return;

    // If not in Telegram, redirect to home
    if (!isTelegramMiniApp) {
      router.replace('/');
      return;
    }

    // If already authenticated, redirect to home
    if (isAuthenticated) {
      router.replace('/');
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
          if (success) {
            router.replace('/');
          } else {
            setError('Authentication failed. Please try again.');
          }
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
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="mb-4 text-4xl">😕</div>
        <h1 className="mb-2 text-xl font-semibold text-white">Something went wrong</h1>
        <p className="mb-6 text-gray-400">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setAuthAttempted(false);
          }}
          className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <Loader size="lg" />
      <p className="mt-4 text-gray-400">
        {isLoading ? 'Signing you in...' : 'Loading...'}
      </p>
    </div>
  );
}
