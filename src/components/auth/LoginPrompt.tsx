'use client';

import { useTranslations } from 'next-intl';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Film02Icon,
  PencilEdit01Icon,
  StarIcon,
  Notification01Icon,
  ArrowReloadHorizontalIcon,
} from '@hugeicons/core-free-icons';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { H4, Muted, Small } from '@/components/ui/typography';

interface LoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  likedCount: number;
}

export function LoginPrompt({ isOpen, onClose, likedCount }: LoginPromptProps) {
  const t = useTranslations('auth');

  const openTelegramBot = () => {
    // Open the Telegram bot
    const botUsername = 'filmberonline_bot';
    const url = `https://t.me/${botUsername}`;

    // Try to open in Telegram app if available
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {t('loginPromptTitle', { defaultValue: 'Save Your Movie Picks!' })}
        </DialogTitle>

        {/* Icon */}
        <div className="mb-4 flex justify-center text-primary">
          <HugeiconsIcon icon={Film02Icon} size={48} />
        </div>

        {/* Title */}
        <H4 className="mb-2 text-center text-foreground">
          {t('loginPromptTitle', { defaultValue: 'Save Your Movie Picks!' })}
        </H4>

        {/* Description */}
        <Muted className="mb-6 text-center">
          {t('loginPromptDescription', {
            count: likedCount,
            defaultValue: `You've liked ${likedCount} movies! Open Filmber in Telegram to save your picks and build your personal watchlist.`,
          })}
        </Muted>

        {/* Features list */}
        <div className="mb-6 space-y-3">
          <Feature
            icon={PencilEdit01Icon}
            text={t('featureWatchlist', { defaultValue: 'Save movies to your watchlist' })}
          />
          <Feature
            icon={StarIcon}
            text={t('featureRating', { defaultValue: 'Rate movies you watched' })}
          />
          <Feature
            icon={Notification01Icon}
            text={t('featureReminders', { defaultValue: 'Get viewing reminders' })}
          />
          <Feature
            icon={ArrowReloadHorizontalIcon}
            text={t('featureSync', { defaultValue: 'Sync across all devices' })}
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button onClick={openTelegramBot} variant="gradient" className="w-full" size="lg">
            {t('openInTelegram', { defaultValue: 'Open in Telegram' })}
          </Button>

          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('maybeLater', { defaultValue: 'Maybe later' })}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Feature({ icon, text }: { icon: IconSvgElement; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <HugeiconsIcon icon={icon} size={20} className="text-primary" />
      <Small className="text-muted-foreground font-normal">{text}</Small>
    </div>
  );
}
