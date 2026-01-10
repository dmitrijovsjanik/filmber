'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useRoomStore } from '@/stores/roomStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { localeNames, type Locale } from '@/i18n/config';

type Mode = 'solo' | 'pair';

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { setRoom, setSoloMode } = useRoomStore();
  const { trackRoomCreated } = useAnalytics();
  const { isAuthenticated, isInitialized } = useAuth();

  const [mode, setMode] = useState<Mode>('pair');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmber_app_bot';

  const handleTelegramLogin = () => {
    window.location.href = `https://t.me/${botUsername}?start=auth`;
  };

  const handlePickMovie = async () => {
    if (mode === 'solo') {
      // Solo mode: generate seed and go directly to swipe
      const seed = Math.floor(Math.random() * 1000000);
      setSoloMode(seed);
      trackRoomCreated('solo');
      router.push(`/${locale}/solo/swipe`);
      return;
    }

    // Pair mode: create room as before
    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      // Join the room as User A
      const joinResponse = await fetch(`/api/rooms/${data.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: data.pin, viaLink: true }),
      });
      const joinData = await joinResponse.json();

      if (!joinResponse.ok) {
        throw new Error(joinData.error || 'Failed to join room');
      }

      setRoom(
        data.roomCode,
        data.pin,
        joinData.userSlot,
        joinData.moviePoolSeed
      );
      trackRoomCreated('pair');
      router.push(`/${locale}/room/${data.roomCode}/swipe`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsCreating(false);
    }
  };

  const modeOptions = [
    { value: 'pair' as const, label: t('home.modePair') },
    { value: 'solo' as const, label: t('home.modeSolo') },
  ];

  const switchLocale = (newLocale: Locale) => {
    router.push(`/${newLocale}`);
  };

  // Show loading state while auth is initializing
  if (!isInitialized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Loader size="lg" />
      </div>
    );
  }

  // Show login screen for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Language switcher */}
        <div className="absolute top-4 right-4 flex gap-2">
          {Object.entries(localeNames).map(([loc, name]) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc as Locale)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                locale === loc
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Logo and tagline */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-4">
            {t('app.name')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {t('app.tagline')}
          </p>
        </div>

        {/* Hero section */}
        <div className="text-center mb-12 max-w-md">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {t('home.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('home.description')}
          </p>
        </div>

        {/* Mode selector and action button */}
        <div className="w-full max-w-sm space-y-6">
          {/* Mode selector */}
          <div className="flex justify-center">
            <SegmentedControl
              options={modeOptions}
              value={mode}
              onChange={setMode}
            />
          </div>

          {/* Pick movie button */}
          <Button
            onClick={handlePickMovie}
            disabled={isCreating}
            variant="gradient"
            className="w-full"
            size="lg"
          >
            {isCreating ? <Loader size="sm" className="mr-2" /> : null}
            {t('home.pickMovie')}
          </Button>

          {/* Error message */}
          {error && (
            <p className="text-red-500 text-center text-sm">{error}</p>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">
                {t('auth.loginTitle')}
              </span>
            </div>
          </div>

          {/* Login button - Telegram brand blue */}
          <button
            onClick={handleTelegramLogin}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-[#0088cc] hover:bg-[#0077b5] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            {t('auth.loginButton')}
          </button>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-4 text-center text-sm text-gray-400">
          <p>Made with ❤️ for movie lovers</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Language switcher */}
      <div className="absolute top-4 right-4 flex gap-2">
        {Object.entries(localeNames).map(([loc, name]) => (
          <button
            key={loc}
            onClick={() => switchLocale(loc as Locale)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              locale === loc
                ? 'bg-pink-500 text-white'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Logo and tagline */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-4">
          {t('app.name')}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          {t('app.tagline')}
        </p>
      </div>

      {/* Hero section */}
      <div className="text-center mb-12 max-w-md">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {t('home.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('home.description')}
        </p>
      </div>

      {/* Mode selector and action button */}
      <div className="w-full max-w-sm space-y-6">
        {/* Mode selector */}
        <div className="flex justify-center">
          <SegmentedControl
            options={modeOptions}
            value={mode}
            onChange={setMode}
          />
        </div>

        {/* Pick movie button */}
        <Button
          onClick={handlePickMovie}
          disabled={isCreating}
          variant="gradient"
          className="w-full"
          size="lg"
        >
          {isCreating ? (
            <Loader size="sm" className="mr-2" />
          ) : null}
          {t('home.pickMovie')}
        </Button>

        {/* Error message */}
        {error && (
          <p className="text-red-500 text-center text-sm">{error}</p>
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center text-sm text-gray-400">
        <p>Made with ❤️ for movie lovers</p>
      </footer>
    </div>
  );
}
