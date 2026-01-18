'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading02Icon, CheckmarkCircle02Icon, Playlist01Icon, Tick02Icon, Add01Icon } from '@hugeicons/core-free-icons';
import { useAuthToken, useIsAuthenticated } from '@/stores/authStore';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { Small } from '@/components/ui/typography';
import { MatchAuthPrompt } from '@/components/auth/MatchAuthPrompt';

interface AddToListButtonProps {
  tmdbId: number;
  currentStatus?: MovieStatus | null;
  onStatusChange?: (status: MovieStatus | null) => void;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AddToListButton({
  tmdbId,
  currentStatus = null,
  onStatusChange,
  showLabel = false,
  size = 'md',
}: AddToListButtonProps) {
  const t = useTranslations('lists');
  const token = useAuthToken();
  const isAuthenticated = useIsAuthenticated();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<MovieStatus | null>(currentStatus);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-10 h-10 text-xl',
    lg: 'w-12 h-12 text-2xl',
  };

  const handleAction = async (newStatus: MovieStatus) => {
    if (!token) return;

    setIsLoading(true);
    try {
      if (status === newStatus) {
        // Remove from list
        const response = await fetch(`/api/lists/${tmdbId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setStatus(null);
          onStatusChange?.(null);
        }
      } else {
        // Add or update
        const response = await fetch('/api/lists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tmdbId,
            status: newStatus,
            source: 'manual',
          }),
        });

        if (response.ok) {
          setStatus(newStatus);
          onStatusChange?.(newStatus);
        }
      }
    } catch (err) {
      console.error('Failed to update list:', err);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
    <div className="relative">
      <motion.button
        onClick={handleButtonClick}
        disabled={isLoading}
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full transition-colors ${
          status
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        {isLoading ? (
          <HugeiconsIcon icon={Loading02Icon} size={20} className="animate-spin" />
        ) : status === MOVIE_STATUS.WATCHED ? (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />
        ) : status === MOVIE_STATUS.WANT_TO_WATCH ? (
          <HugeiconsIcon icon={Playlist01Icon} size={20} />
        ) : (
          <HugeiconsIcon icon={Add01Icon} size={20} />
        )}
      </motion.button>

      {showLabel && status && (
        <Small className="ml-2 text-muted-foreground font-normal">
          {status === MOVIE_STATUS.WATCHED
            ? t('watched', { defaultValue: 'Watched' })
            : t('wantToWatch', { defaultValue: 'Want to watch' })}
        </Small>
      )}

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg bg-gray-800 shadow-xl"
            >
              <button
                onClick={() => handleAction(MOVIE_STATUS.WANT_TO_WATCH)}
                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${
                  status === MOVIE_STATUS.WANT_TO_WATCH
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <HugeiconsIcon icon={Playlist01Icon} size={16} />
                <span>{t('wantToWatch', { defaultValue: 'Want to watch' })}</span>
                {status === MOVIE_STATUS.WANT_TO_WATCH && (
                  <HugeiconsIcon icon={Tick02Icon} size={16} className="ml-auto" />
                )}
              </button>

              <button
                onClick={() => handleAction(MOVIE_STATUS.WATCHED)}
                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${
                  status === MOVIE_STATUS.WATCHED
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                <span>{t('watched', { defaultValue: 'Watched' })}</span>
                {status === MOVIE_STATUS.WATCHED && (
                  <HugeiconsIcon icon={Tick02Icon} size={16} className="ml-auto" />
                )}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>

    {/* Auth prompt for unauthenticated users */}
    <MatchAuthPrompt
      isOpen={showAuthPrompt}
      onClose={() => setShowAuthPrompt(false)}
      onContinueWithoutSave={() => setShowAuthPrompt(false)}
      likedMovies={[]}
    />
    </>
  );
}
