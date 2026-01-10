'use client';

import { useTranslations } from 'next-intl';
import { ShareLink } from './ShareLink';
import { Loader } from '../ui/Loader';

interface WaitingRoomProps {
  roomCode: string;
  pin: string;
  isPartnerConnected: boolean;
}

export function WaitingRoom({
  roomCode,
  pin,
  isPartnerConnected,
}: WaitingRoomProps) {
  const t = useTranslations('room');

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <ShareLink roomCode={roomCode} pin={pin} />

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
              {t('connected')}
            </p>
            <p className="text-sm text-gray-500">{t('startingSoon')}</p>
          </>
        ) : (
          <>
            <Loader size="lg" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {t('waiting')}
            </p>
          </>
        )}
      </div>

    </div>
  );
}
