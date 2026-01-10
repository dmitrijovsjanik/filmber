'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useAuthToken, useIsAuthenticated } from '@/stores/authStore';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';

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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full transition-colors ${
          status
            ? 'bg-emerald-600 text-white'
            : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        {isLoading ? (
          <span className="animate-spin">⏳</span>
        ) : status === MOVIE_STATUS.WATCHED ? (
          '✅'
        ) : status === MOVIE_STATUS.WANT_TO_WATCH ? (
          '📋'
        ) : (
          '+'
        )}
      </motion.button>

      {showLabel && status && (
        <span className="ml-2 text-sm text-gray-400">
          {status === MOVIE_STATUS.WATCHED
            ? t('watched', { defaultValue: 'Watched' })
            : t('wantToWatch', { defaultValue: 'Want to watch' })}
        </span>
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
                <span>📋</span>
                <span>{t('wantToWatch', { defaultValue: 'Want to watch' })}</span>
                {status === MOVIE_STATUS.WANT_TO_WATCH && (
                  <span className="ml-auto">✓</span>
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
                <span>✅</span>
                <span>{t('watched', { defaultValue: 'Watched' })}</span>
                {status === MOVIE_STATUS.WATCHED && <span className="ml-auto">✓</span>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
