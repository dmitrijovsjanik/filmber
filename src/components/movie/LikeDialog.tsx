'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-xl"
          >
            {/* Movie poster header */}
            <div className="relative h-32 bg-gradient-to-b from-pink-500 to-rose-500 flex items-end justify-center pb-4">
              {movie.posterUrl && (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="absolute -bottom-8 w-20 h-28 object-cover rounded-lg shadow-lg border-4 border-white dark:border-gray-800"
                />
              )}
            </div>

            <div className="pt-12 pb-6 px-6">
              {step === 'question' ? (
                <>
                  <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-2">
                    {t('didYouWatch')}
                  </h3>
                  <p className="text-center text-gray-600 dark:text-gray-400 mb-6 line-clamp-1">
                    {movie.title}
                  </p>

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
                  <button
                    onClick={() => setStep('question')}
                    className="absolute top-4 left-4 text-white/80 hover:text-white"
                    disabled={isLoading}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-6">
                    {t('howWasIt')}
                  </h3>

                  <div className="flex justify-center gap-4 mb-4">
                    {[1, 2, 3].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleRating(rating)}
                        disabled={isLoading}
                        className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        <div className="flex">
                          {[...Array(rating)].map((_, i) => (
                            <svg
                              key={i}
                              className="w-8 h-8 text-yellow-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          {[...Array(3 - rating)].map((_, i) => (
                            <svg
                              key={i}
                              className="w-8 h-8 text-gray-300 dark:text-gray-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
