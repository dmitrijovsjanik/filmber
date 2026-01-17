'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Settings01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { H1, Lead, Muted } from '@/components/ui/typography';
import { DeckSettingsSheet } from '@/components/deck/DeckSettingsSheet';
import { useRoomStore } from '@/stores/roomStore';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

// Parse room params from startapp parameter (format: room_{code}_{pin})
function parseRoomParam(startParam?: string): { code: string; pin: string } | null {
  if (!startParam) return null;
  const match = startParam.match(/^room_([A-Z0-9]+)_(\d+)$/i);
  if (!match) return null;
  return { code: match[1].toUpperCase(), pin: match[2] };
}

// Parse movie params from startapp parameter
// Supports formats:
// - movie_{tmdbId} or tv_{tmdbId} (legacy)
// - {locale}_movie_{tmdbId} or {locale}_tv_{tmdbId} (new with locale)
function parseMovieParam(startParam?: string): { tmdbId: string; type: 'movie' | 'tv'; locale?: string } | null {
  if (!startParam) return null;

  // Try new format with locale: ru_movie_123 or en_tv_456
  const matchWithLocale = startParam.match(/^(ru|en)_(movie|tv)_(\d+)$/i);
  if (matchWithLocale) {
    return {
      locale: matchWithLocale[1].toLowerCase(),
      type: matchWithLocale[2].toLowerCase() as 'movie' | 'tv',
      tmdbId: matchWithLocale[3],
    };
  }

  // Try legacy format: movie_123 or tv_456
  const match = startParam.match(/^(movie|tv)_(\d+)$/i);
  if (!match) return null;
  return { type: match[1].toLowerCase() as 'movie' | 'tv', tmdbId: match[2] };
}

type Mode = 'solo' | 'pair';

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { setRoom, setSoloMode } = useRoomStore();
  const { trackRoomCreated } = useAnalytics();
  const { isAuthenticated, isInitialized } = useAuth();
  const { startParam, isReady: isTgReady } = useTelegramWebApp();

  const [mode, setMode] = useState<Mode>('pair');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const joinAttemptedRef = useRef(false);

  // Auto-join room from startapp parameter
  useEffect(() => {
    if (!isTgReady || joinAttemptedRef.current) return;

    const roomParams = parseRoomParam(startParam);
    if (!roomParams) return;

    joinAttemptedRef.current = true;
    setIsJoiningRoom(true);

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
        router.push(`/${locale}/room/${roomParams.code}/swipe`);
      } catch (err) {
        console.error('Auto-join failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to join room');
        setIsJoiningRoom(false);
      }
    };

    joinRoom();
  }, [isTgReady, startParam, locale, router, setRoom]);

  // Handle movie/tv startapp parameter - redirect to lists page with movie modal
  useEffect(() => {
    if (!isTgReady || joinAttemptedRef.current) return;

    const movieParams = parseMovieParam(startParam);
    if (!movieParams) return;

    joinAttemptedRef.current = true;
    // Use locale from startapp if provided, otherwise use current locale
    const targetLocale = movieParams.locale || locale;
    router.push(`/${targetLocale}/lists?openMovie=${movieParams.tmdbId}&type=${movieParams.type}`);
  }, [isTgReady, startParam, locale, router]);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';

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


  // Show loading state while auth is initializing or joining room
  if (!isInitialized || isJoiningRoom) {
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
        {/* Centered content group */}
        <div className="flex flex-col items-center w-full max-w-[280px]">
          {/* Logo and tagline */}
          <div className="text-center mb-8">
            <H1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-4">
              {t('app.name')}
            </H1>
            <Lead className="whitespace-pre-line">
              {t('app.tagline')}
            </Lead>
          </div>

          {/* Mode selector and action button */}
          <div className="w-full space-y-6">
            {/* Mode selector */}
            <div className="flex justify-center">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid grid-cols-2 auto-cols-max">
                  <TabsTrigger value="pair">{t('home.modePair')}</TabsTrigger>
                  <TabsTrigger value="solo">{t('home.modeSolo')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Pick movie button */}
            <Button
              onClick={handlePickMovie}
              disabled={isCreating}
                            className="w-full"
              size="lg"
            >
              {isCreating ? <Loader size="sm" className="mr-2" /> : null}
              {t('home.pickMovie')}
            </Button>

            {/* Error message */}
            {error && (
              <p className="text-destructive text-center text-sm">{error}</p>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('auth.loginTitle')}
                </span>
              </div>
            </div>

            {/* Login button - Telegram brand blue */}
            <button
              onClick={handleTelegramLogin}
              className="min-h-12 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-[#0088cc] hover:bg-[#0077b5] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              {t('auth.loginButton')}
            </button>
          </div>

          {/* Footer */}
          <footer className="mt-8 text-center text-sm text-muted-foreground">
            <p>{t('footer.madeWith')}</p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {/* Centered content group */}
      <div className="flex flex-col items-center w-full max-w-[280px]">
        {/* Logo and tagline */}
        <div className="text-center mb-8">
          <H1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-4">
            {t('app.name')}
          </H1>
          <Lead className="whitespace-pre-line">
            {t('app.tagline')}
          </Lead>
        </div>

        {/* Mode selector and action button */}
        <div className="w-full space-y-6">
          {/* Mode selector with settings button */}
          <div className="flex justify-center items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-2 auto-cols-max">
                <TabsTrigger value="pair">{t('home.modePair')}</TabsTrigger>
                <TabsTrigger value="solo">{t('home.modeSolo')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9 shrink-0"
            >
              <HugeiconsIcon icon={Settings01Icon} size={20} />
            </Button>
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
            <Muted className="text-destructive text-center">{error}</Muted>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <Muted>{t('footer.madeWith')}</Muted>
        </footer>
      </div>

      {/* Deck Settings Sheet */}
      <DeckSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
