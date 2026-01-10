'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useRoomStore } from '@/stores/roomStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { localeNames, type Locale } from '@/i18n/config';

type Mode = 'solo' | 'pair';

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { setRoom, setSoloMode } = useRoomStore();
  const { trackRoomCreated } = useAnalytics();

  const [mode, setMode] = useState<Mode>('pair');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

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
