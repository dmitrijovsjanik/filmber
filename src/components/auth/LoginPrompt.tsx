'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2"
          >
            {/* Icon */}
            <div className="mb-4 text-center text-5xl">🎬</div>

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
                emoji="📝"
                text={t('featureWatchlist', { defaultValue: 'Save movies to your watchlist' })}
              />
              <Feature
                emoji="⭐️"
                text={t('featureRating', { defaultValue: 'Rate movies you watched' })}
              />
              <Feature
                emoji="🔔"
                text={t('featureReminders', { defaultValue: 'Get viewing reminders' })}
              />
              <Feature
                emoji="🔄"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Feature({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{emoji}</span>
      <Small className="text-muted-foreground font-normal">{text}</Small>
    </div>
  );
}
