'use client';

import { ShareLink } from './ShareLink';
import { Loader } from '../ui/Loader';

interface WaitingRoomProps {
  roomCode: string;
  pin: string;
  isPartnerConnected: boolean;
  locale?: string;
}

export function WaitingRoom({
  roomCode,
  pin,
  isPartnerConnected,
  locale = 'en',
}: WaitingRoomProps) {
  const t = {
    waiting: locale === 'ru' ? 'Ожидаем партнёра...' : 'Waiting for partner...',
    connected:
      locale === 'ru' ? 'Партнёр подключился!' : 'Partner connected!',
    startingSoon:
      locale === 'ru' ? 'Начинаем через секунду...' : 'Starting soon...',
  };

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <ShareLink roomCode={roomCode} pin={pin} locale={locale} />

      <div className="flex flex-col items-center gap-4">
        {isPartnerConnected ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-green-600 dark:text-green-400">
              {t.connected}
            </p>
            <p className="text-sm text-gray-500">{t.startingSoon}</p>
          </>
        ) : (
          <>
            <Loader size="lg" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {t.waiting}
            </p>
          </>
        )}
      </div>

      {/* Connection status indicators */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {locale === 'ru' ? 'Вы' : 'You'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isPartnerConnected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {locale === 'ru' ? 'Партнёр' : 'Partner'}
          </span>
        </div>
      </div>
    </div>
  );
}
