'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { PinInput } from '@/components/room/PinInput';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/Loader';
import { useRoomStore } from '@/stores/roomStore';

export default function JoinRoomPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.roomCode as string;
  const pinFromUrl = searchParams.get('pin') || '';

  const { setRoom } = useRoomStore();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const hasAutoJoined = useRef(false);

  const handlePinComplete = useCallback(async (pin: string) => {
    setIsJoining(true);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError(t('join.invalidPin'));
        } else if (response.status === 404) {
          setError(t('join.roomNotFound'));
        } else if (response.status === 409) {
          setError(t('join.roomFull'));
        } else if (response.status === 410) {
          setError(t('join.roomExpired'));
        } else {
          setError(data.error || t('errors.somethingWentWrong'));
        }
        setIsJoining(false);
        return;
      }

      setRoom(roomCode, pin, data.userSlot, data.moviePoolSeed);
      router.push(`/${locale}/room/${roomCode}/swipe`);
    } catch {
      setError(t('errors.somethingWentWrong'));
      setIsJoining(false);
    }
  }, [roomCode, locale, router, setRoom, t]);

  // Auto-join if PIN is provided in URL (from QR code)
  useEffect(() => {
    if (hasAutoJoined.current) return;
    if (pinFromUrl && pinFromUrl.length === 6 && /^\d+$/.test(pinFromUrl)) {
      hasAutoJoined.current = true;
      // Defer to avoid setState during render
      const timer = setTimeout(() => {
        handlePinComplete(pinFromUrl);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pinFromUrl, handlePinComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('join.title')}
        </h1>
        <p className="text-gray-500">
          {t('home.enterCode')}: <span className="font-mono font-bold">{roomCode}</span>
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div>
          <label className="block text-center text-gray-600 dark:text-gray-400 mb-4">
            {t('join.enterPin')}
          </label>
          <PinInput
            onComplete={handlePinComplete}
            disabled={isJoining}
          />
        </div>

        {isJoining && (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader size="sm" />
            <span>{t('join.joining')}</span>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-center text-sm">{error}</p>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push(`/${locale}`)}
          className="w-full"
        >
          &larr; {t('errors.tryAgain')}
        </Button>
      </div>
    </div>
  );
}
