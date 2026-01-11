'use client';

import { useTranslations } from 'next-intl';
import { ShareLink } from './ShareLink';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

interface WaitingRoomProps {
  roomCode: string;
  pin: string;
  isPartnerConnected: boolean;
  onCancel?: () => void;
}

export function WaitingRoom({
  roomCode,
  pin,
  isPartnerConnected,
  onCancel,
}: WaitingRoomProps) {
  const t = useTranslations('room');

  if (isPartnerConnected) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={32} className="text-emerald-500" />
        </div>
        <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-medium text-white">
          {t('connected')}
        </span>
        <p className="text-sm text-muted-foreground">{t('startingSoon')}</p>
      </div>
    );
  }

  return <ShareLink roomCode={roomCode} pin={pin} onCancel={onCancel} />;
}
