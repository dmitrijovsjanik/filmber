'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { TMDBClient } from '@/lib/api/tmdb';
import { AddToListButton } from './AddToListButton';
import type { SearchResult } from '@/types/movie';

interface SearchResultItemProps extends SearchResult {
  onAddedToList?: () => void;
}

export function SearchResultItem({
  tmdbId,
  imdbId,
  title,
  titleRu,
  posterPath,
  releaseDate,
  voteAverage,
  overview,
  overviewRu,
  source,
  onAddedToList,
}: SearchResultItemProps) {
  const t = useTranslations('lists');
  const [expanded, setExpanded] = useState(false);

  const posterUrl =
    source === 'tmdb'
      ? TMDBClient.getPosterUrl(posterPath)
      : posterPath || '/images/no-poster.svg';

  const year = releaseDate
    ? releaseDate.length === 4
      ? releaseDate
      : new Date(releaseDate).getFullYear()
    : null;

  // Display Russian title as primary, English as secondary
  const displayTitle = titleRu || title;
  const secondaryTitle = titleRu && titleRu !== title ? title : null;

  // Display Russian overview as primary, English as secondary
  const displayOverview = overviewRu || overview;
  const secondaryOverview = overviewRu && overviewRu !== overview ? overview : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl bg-gray-800/50"
    >
      <div
        className="flex cursor-pointer gap-3 p-3"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Poster */}
        <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-700">
          {posterPath ? (
            <img
              src={posterUrl}
              alt={displayTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">
              🎬
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center gap-1">
          <h3 className="line-clamp-2 font-semibold text-white">{displayTitle}</h3>
          {secondaryTitle && (
            <p className="line-clamp-1 text-xs text-gray-500">{secondaryTitle}</p>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {year && <span>{year}</span>}
            {voteAverage && <span>⭐ {parseFloat(voteAverage).toFixed(1)}</span>}
          </div>
        </div>

        {/* Add button - only show for TMDB results */}
        {tmdbId && (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <AddToListButton
              tmdbId={tmdbId}
              size="sm"
              onStatusChange={() => onAddedToList?.()}
            />
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-gray-700 px-3 py-3"
        >
          {displayOverview ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">{displayOverview}</p>
              {secondaryOverview && (
                <p className="text-xs text-gray-500">{secondaryOverview}</p>
              )}
            </div>
          ) : (
            <p className="text-sm italic text-gray-500">
              {t('noDescription', { defaultValue: 'No description available' })}
            </p>
          )}

          {/* For OMDB results without tmdbId, show info about adding */}
          {!tmdbId && imdbId && (
            <p className="mt-2 text-xs text-gray-500">
              {t('omdbOnlyHint', {
                defaultValue: 'IMDB ID: ',
              })}
              {imdbId}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
