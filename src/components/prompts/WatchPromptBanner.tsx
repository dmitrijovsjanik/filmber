'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useAuthToken, useIsAuthenticated } from '@/stores/authStore';
import { RatingStars } from '@/components/lists/RatingStars';

interface Prompt {
  id: string;
  tmdbId: number;
  promptedAt: string;
  movie: {
    title: string;
    titleRu: string | null;
    posterPath: string | null;
    releaseDate: string | null;
  } | null;
}

export function WatchPromptBanner() {
  const t = useTranslations('prompts');
  const token = useAuthToken();
  const isAuthenticated = useIsAuthenticated();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const currentPrompt = prompts[currentIndex];

  const fetchPrompts = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/prompts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts);
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPrompts();
    }
  }, [isAuthenticated, fetchPrompts]);

  const handleResponse = async (response: 'watched' | 'not_yet' | 'dismissed') => {
    if (!token || !currentPrompt) return;

    try {
      const body: { response: string; rating?: number } = { response };
      if (response === 'watched' && selectedRating) {
        body.rating = selectedRating;
      }

      await fetch(`/api/prompts/${currentPrompt.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      // Move to next prompt or hide
      if (currentIndex < prompts.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowRating(false);
        setSelectedRating(null);
      } else {
        setIsDismissed(true);
      }
    } catch (err) {
      console.error('Failed to respond to prompt:', err);
    }
  };

  // Don't show if not authenticated, loading, no prompts, or dismissed
  if (!isAuthenticated || isLoading || prompts.length === 0 || isDismissed) {
    return null;
  }

  const posterUrl = currentPrompt?.movie?.posterPath
    ? `https://image.tmdb.org/t/p/w92${currentPrompt.movie.posterPath}`
    : null;

  const movieTitle = currentPrompt?.movie?.title || `Movie #${currentPrompt?.tmdbId}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPrompt?.id}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-4 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900/50 to-blue-900/50 p-4"
      >
        <div className="flex items-start gap-3">
          {/* Poster thumbnail */}
          {posterUrl && (
            <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700">
              <img
                src={posterUrl}
                alt={movieTitle}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1">
            <p className="mb-1 text-sm text-gray-300">
              {t('didYouWatch', { defaultValue: 'Did you watch' })}
            </p>
            <p className="mb-3 font-semibold text-white">{movieTitle}?</p>

            {showRating ? (
              // Rating selection
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  {t('howWasIt', { defaultValue: 'How was it?' })}
                </p>
                <RatingStars
                  rating={selectedRating}
                  onChange={setSelectedRating}
                  size="lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResponse('watched')}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    {t('save', { defaultValue: 'Save' })}
                  </button>
                  <button
                    onClick={() => {
                      setShowRating(false);
                      setSelectedRating(null);
                    }}
                    className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
                  >
                    {t('back', { defaultValue: 'Back' })}
                  </button>
                </div>
              </div>
            ) : (
              // Initial buttons
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowRating(true)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  ✅ {t('yesWatched', { defaultValue: 'Yes, watched!' })}
                </button>
                <button
                  onClick={() => handleResponse('not_yet')}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
                >
                  ⏳ {t('notYet', { defaultValue: 'Not yet' })}
                </button>
                <button
                  onClick={() => handleResponse('dismissed')}
                  className="rounded-lg px-2 py-2 text-sm text-gray-500 transition-colors hover:text-gray-400"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress dots */}
        {prompts.length > 1 && (
          <div className="mt-3 flex justify-center gap-1">
            {prompts.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === currentIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
