'use client';

import { useTranslations } from 'next-intl';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Film02Icon,
  FavouriteIcon,
  Notification01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { H4, Muted, Small } from '@/components/ui/typography';
import { FadeImage } from '@/components/ui/FadeImage';

interface LikedMovie {
  tmdbId: number;
  posterPath: string | null;
  title: string;
  mediaType: 'movie' | 'tv';
}

interface MatchAuthPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithoutSave: () => void;
  likedMovies: LikedMovie[];
}

export function MatchAuthPrompt({
  isOpen,
  onClose,
  onContinueWithoutSave,
  likedMovies,
}: MatchAuthPromptProps) {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {t('matchAuthTitle', { defaultValue: 'Movie Found!' })}
        </DialogTitle>

        {/* Icon */}
        <div className="mb-4 flex justify-center text-primary">
          <HugeiconsIcon icon={Film02Icon} size={48} />
        </div>

        {/* Title */}
        <H4 className="mb-2 text-center text-foreground">
          {t('matchAuthTitle', { defaultValue: 'Movie Found!' })}
        </H4>

        {/* Subtitle */}
        <Muted className="mb-4 text-center">
          {t('matchAuthSubtitle', { defaultValue: 'Save your picks' })}
        </Muted>

        {/* Liked movies preview */}
        {likedMovies.length > 0 && (
          <div className="mb-6 flex justify-center gap-2 overflow-x-auto py-2">
            {likedMovies.slice(0, 5).map((movie) => (
              <div
                key={movie.tmdbId}
                className="flex flex-col items-center w-16 flex-shrink-0"
              >
                <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                  {movie.posterPath ? (
                    <FadeImage
                      src={movie.posterPath}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HugeiconsIcon icon={Film02Icon} size={24} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <Small className="mt-1 text-center text-muted-foreground line-clamp-2 text-[10px] leading-tight">
                  {movie.title}
                </Small>
              </div>
            ))}
            {likedMovies.length > 5 && (
              <div className="flex flex-col items-center justify-center w-14">
                <div className="w-14 h-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <Small className="text-muted-foreground">+{likedMovies.length - 5}</Small>
                </div>
              </div>
            )}
          </div>
        )}

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
          <Button onClick={openTelegramBot} className="w-full" size="lg">
            {t('loginButton', { defaultValue: 'Log in with Telegram' })}
          </Button>

          <button
            onClick={handleContinueWithoutSave}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t('continueWithoutSave', { defaultValue: 'Continue without saving' })}
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
