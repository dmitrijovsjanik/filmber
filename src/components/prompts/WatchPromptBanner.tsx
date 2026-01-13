'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Film02Icon, CheckmarkCircle02Icon, TimeHalfPassIcon } from '@hugeicons/core-free-icons';
import { useAuthToken, useIsAuthenticated } from '@/stores/authStore';
import { RatingStars } from '@/components/lists/RatingStars';
import { Small, Large, Muted } from '@/components/ui/typography';

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
        className="relative mb-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-lg shadow-emerald-500/10"
      >
        {/* Dismiss button */}
        <button
          onClick={() => handleResponse('dismissed')}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>

        <div className="flex items-start gap-4">
          {/* Poster thumbnail */}
          {posterUrl && (
            <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl}
                alt={movieTitle}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 pr-6">
            <Small className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <HugeiconsIcon icon={Film02Icon} size={16} />
              {t('didYouWatch', { defaultValue: 'Did you watch' })}
            </Small>
            <Large className="mb-4 text-foreground">{movieTitle}?</Large>

            {showRating ? (
              // Rating selection
              <div className="space-y-4">
                <Muted>
                  {t('howWasIt', { defaultValue: 'How was it?' })}
                </Muted>
                <RatingStars
                  rating={selectedRating}
                  onChange={setSelectedRating}
                  size="lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResponse('watched')}
                    disabled={!selectedRating}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {t('save', { defaultValue: 'Save' })}
                  </button>
                  <button
                    onClick={() => {
                      setShowRating(false);
                      setSelectedRating(null);
                    }}
                    className="rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    {t('back', { defaultValue: 'Back' })}
                  </button>
                </div>
              </div>
            ) : (
              // Initial buttons
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRating(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-500"
                >
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                  {t('yesWatched', { defaultValue: 'Yes!' })}
                </button>
                <button
                  onClick={() => handleResponse('not_yet')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                >
                  <HugeiconsIcon icon={TimeHalfPassIcon} size={16} />
                  {t('notYet', { defaultValue: 'Not yet' })}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress dots */}
        {prompts.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5">
            {prompts.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
