'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RatingStars } from './RatingStars';

interface WatchCompletePromptProps {
  movieTitle: string;
  onWatched: (rating: number) => void;
  onNotYet: () => void;
  isLoading?: boolean;
}

export function WatchCompletePrompt({
  movieTitle,
  onWatched,
  onNotYet,
  isLoading = false,
}: WatchCompletePromptProps) {
  const t = useTranslations('prompts');
  const [showRating, setShowRating] = useState(false);

  const handleYesClick = () => {
    setShowRating(true);
  };

  const handleRatingSelect = (rating: number) => {
    if (rating > 0) {
      onWatched(rating);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-gray-700 bg-gradient-to-r from-emerald-900/20 to-transparent"
    >
      <div className="p-3">
        {!showRating ? (
          <>
            <p className="mb-3 text-sm text-gray-300">
              {t('didYouWatch')} <span className="font-medium text-white">{movieTitle}</span>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleYesClick}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {t('yesWatched')}
              </button>
              <button
                onClick={onNotYet}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 disabled:opacity-50"
              >
                {t('notYet')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-300">{t('howWasIt')}</p>
            <div className="flex justify-center">
              <RatingStars
                rating={0}
                onChange={handleRatingSelect}
                size="lg"
                readonly={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
