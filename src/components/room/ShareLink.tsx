'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { H4, Muted } from '@/components/ui/typography';
import { Loader } from '@/components/ui/Loader';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share01Icon } from '@hugeicons/core-free-icons';
import { useAnalytics } from '@/hooks/useAnalytics';

interface ShareLinkProps {
  roomCode: string;
  pin: string;
  onCancel?: () => void;
}

export function ShareLink({ roomCode, pin, onCancel }: ShareLinkProps) {
  const t = useTranslations('room');
  const tCommon = useTranslations('common');
  const { trackShareRoom } = useAnalytics();

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';

  // TG Mini App link with startapp parameter for instant join
  const startAppParam = `room_${roomCode}_${pin}`;
  const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app';
  const tgAppUrl = `https://t.me/${botUsername}/${miniAppName}?startapp=${startAppParam}`;

  const handleShare = async () => {
    trackShareRoom();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Filmber',
          text: t('shareMessage'),
          url: tgAppUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: open Telegram share
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(tgAppUrl)}&text=${encodeURIComponent(t('shareMessage'))}`;
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-6">
      {/* Header with spinner */}
      <div className="flex flex-col items-center gap-3">
        <Loader size="lg" />
        <H4 className="text-foreground">{t('waiting')}</H4>
        <Muted>{t('shareLink')}</Muted>
      </div>

      {/* QR Code */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <QRCodeSVG
          value={tgAppUrl}
          size={200}
          level="M"
          fgColor="#ec4899"
          bgColor="#ffffff"
        />
      </div>

      <Muted>{t('scanQr')}</Muted>

      {/* Buttons */}
      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={handleShare}
          variant="gradient"
          className="w-full"
          size="lg"
        >
          <HugeiconsIcon icon={Share01Icon} size={24} />
          {t('share')}
        </Button>

        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
            size="lg"
          >
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
