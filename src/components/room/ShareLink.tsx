'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { H4, Muted } from '@/components/ui/typography';
import { Loader } from '@/components/ui/Loader';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share01Icon } from '@hugeicons/core-free-icons';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';

interface ShareLinkProps {
  roomCode: string;
  pin: string;
  onCancel?: () => void;
}

export function ShareLink({ roomCode, pin, onCancel }: ShareLinkProps) {
  const t = useTranslations('room');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { trackShareRoom } = useAnalytics();
  const { webApp, isTelegramMiniApp } = useTelegramWebApp();

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'filmberonline_bot';

  // TG Mini App link with startapp parameter for instant join
  const startAppParam = `room_${roomCode}_${pin}`;
  const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app';
  const tgAppUrl = `https://t.me/${botUsername}/${miniAppName}?startapp=${startAppParam}`;

  // Web link for non-Telegram users (direct room join)
  // Use window.location.origin to work with any domain (localhost, tunnel, production)
  // Note: room page at /room/CODE supports ?pin= param for auto-join
  const webJoinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${locale}/room/${roomCode}?pin=${pin}`
    : `/${locale}/room/${roomCode}?pin=${pin}`;

  // Use TG link inside Telegram, web link otherwise
  const shareUrl = isTelegramMiniApp ? tgAppUrl : webJoinUrl;

  const handleShare = async () => {
    trackShareRoom();

    // Build share URL with both message text and link
    const shareText = `${t('shareMessage')}\n${shareUrl}`;
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(t('shareMessage'))}`;

    // In Telegram Mini App, use openTelegramLink for native share dialog
    if (isTelegramMiniApp && webApp?.openTelegramLink) {
      webApp.openTelegramLink(telegramShareUrl);
      return;
    }

    // On other platforms, try native share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Filmber',
          text: shareText,
        });
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }

    // Fallback: open Telegram share in new window
    window.open(telegramShareUrl, '_blank');
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
          value={shareUrl}
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
