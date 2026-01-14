'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, StarIcon } from '@hugeicons/core-free-icons';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Large, Muted } from '@/components/ui/typography';
import type { Movie } from '@/types/movie';

interface LikeDialogProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onSave: (status: 'want_to_watch' | 'watched', rating?: number) => void;
}

export function LikeDialog({ movie, isOpen, onClose, onSave }: LikeDialogProps) {
  const t = useTranslations('prompts');
  const [step, setStep] = useState<'question' | 'rating'>('question');
  const [isLoading, setIsLoading] = useState(false);

  const handleWatched = () => {
    setStep('rating');
  };

  const handleNotYet = async () => {
    setIsLoading(true);
    await onSave('want_to_watch');
    setIsLoading(false);
    handleClose();
  };

  const handleRating = async (rating: number) => {
    setIsLoading(true);
    await onSave('watched', rating);
    setIsLoading(false);
    handleClose();
  };

  const handleClose = () => {
    setStep('question');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl gap-0">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {step === 'question' ? t('didYouWatch') : t('howWasIt')}
        </DialogTitle>

        {/* Movie poster header */}
        <div className="relative h-32 bg-gradient-to-b from-pink-500 to-rose-500 flex items-end justify-center pb-4">
          {movie.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="absolute -bottom-8 w-20 h-28 object-cover rounded-lg shadow-lg border-4 border-background"
            />
          )}
          {/* Back button in rating step */}
          {step === 'rating' && (
            <button
              onClick={() => setStep('question')}
              className="absolute top-4 left-4 text-white/80 hover:text-white disabled:opacity-50"
              disabled={isLoading}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
            </button>
          )}
        </div>

        <div className="pt-12 pb-6 px-6">
          {step === 'question' ? (
            <>
              <Large className="text-center text-foreground mb-2">
                {t('didYouWatch')}
              </Large>
              <Muted className="text-center mb-6 line-clamp-1">
                {movie.title}
              </Muted>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleWatched}
                  disabled={isLoading}
                  className="w-full"
                >
                  {t('yesWatched')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNotYet}
                  disabled={isLoading}
                  className="w-full"
                >
                  {t('notYet')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Large className="text-center text-foreground mb-6">
                {t('howWasIt')}
              </Large>

              <div className="flex justify-center gap-4 mb-4">
                {[1, 2, 3].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleRating(rating)}
                    disabled={isLoading}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="flex">
                      {[...Array(rating)].map((_, i) => (
                        <HugeiconsIcon
                          key={i}
                          icon={StarIcon}
                          size={32}
                          className="text-yellow-400"
                          fill="currentColor"
                        />
                      ))}
                      {[...Array(3 - rating)].map((_, i) => (
                        <HugeiconsIcon
                          key={`empty-${i}`}
                          icon={StarIcon}
                          size={32}
                          className="text-muted-foreground/30"
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
