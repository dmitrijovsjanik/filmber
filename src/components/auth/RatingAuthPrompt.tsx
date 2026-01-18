'use client';

import { useTranslations } from 'next-intl';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Cancel01Icon,
  FavouriteIcon,
  Notification01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { H4, Muted, Small } from '@/components/ui/typography';

interface RatingAuthPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithoutSave: () => void;
}

export function RatingAuthPrompt({
  isOpen,
  onClose,
  onContinueWithoutSave,
}: RatingAuthPromptProps) {
  const t = useTranslations('auth');

  const openTelegramBot = () => {
    const botUsername = 'filmberonline_bot';
    const url = `https://t.me/${botUsername}`;
    window.open(url, '_blank');
    onClose();
  };

  const handleContinueWithoutSave = () => {
    onContinueWithoutSave();
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md rounded-2xl z-[100]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
          <span className="sr-only">Close</span>
        </button>

        {/* Visually hidden title for accessibility */}
        <AlertDialogTitle className="sr-only">
          {t('ratingAuthTitle', { defaultValue: 'Rate Movies' })}
        </AlertDialogTitle>

        {/* Compact header: title + subtitle */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <H4 className="text-center text-foreground">
            {t('ratingAuthTitle', { defaultValue: 'Rate Movies' })}
          </H4>
          <Muted className="text-center text-sm">
            {t('ratingAuthSubtitle', { defaultValue: 'Log in to save your ratings' })}
          </Muted>
        </div>

        {/* Features list */}
        <div className="mb-6 space-y-3">
          <Feature
            icon={FavouriteIcon}
            text={t('matchBenefitSave', { defaultValue: 'Save your favorite movies' })}
          />
          <Feature
            icon={SparklesIcon}
            text={t('matchBenefitPersonal', { defaultValue: 'Get personalized recommendations' })}
          />
          <Feature
            icon={Notification01Icon}
            text={t('matchBenefitNotify', { defaultValue: 'Get notified about new releases' })}
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={openTelegramBot}
            className="min-h-12 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-[#0088cc] hover:bg-[#0077b5] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            {t('loginButton', { defaultValue: 'Log in with Telegram' })}
          </button>

          <button
            onClick={handleContinueWithoutSave}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('continueWithoutSave', { defaultValue: 'Continue without saving' })}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
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
