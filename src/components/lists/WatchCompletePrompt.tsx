'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RatingStars } from './RatingStars';

interface WatchCompletePromptProps {
  movieTitle: string;
  onWatched: (rating: number) => void;
  onNotFinished: () => void;
  isLoading?: boolean;
}

export function WatchCompletePrompt({
  movieTitle,
  onWatched,
  onNotFinished,
  isLoading = false,
}: WatchCompletePromptProps) {
  const t = useTranslations('prompts');
  const tLists = useTranslations('lists');

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
      className="overflow-hidden"
    >
      <Card className="mt-2 border border-border bg-card">
        <CardContent className="p-3 space-y-2">
          {/* Header with movie title */}
          <p className="text-sm text-center text-muted-foreground">
            {t('howWasMovie', { title: movieTitle, defaultValue: `How was "${movieTitle}"?` })}
          </p>

          <div className="flex items-center justify-center gap-4">
            {/* Want to watch button */}
            <Button
              variant="secondary"
              onClick={onNotFinished}
              disabled={isLoading}
              className="h-10"
            >
              {tLists('wantToWatch', { defaultValue: 'Want to watch' })}
            </Button>

            {/* Rating stars */}
            <RatingStars
              rating={0}
              onChange={handleRatingSelect}
              size="md"
              readonly={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
