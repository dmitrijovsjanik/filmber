'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { MediaType } from '@/types/movie';

export interface MovieBadgesProps {
  /** Variant determines badge styling: 'card' for swipe cards, 'list' for list items */
  variant: 'card' | 'list';
  /** Media type (movie or tv) */
  mediaType?: MediaType;
  /** Release date string (ISO format) */
  releaseDate?: string | null;
  /** Runtime in minutes (for movies) */
  runtime?: number | null;
  /** Number of seasons (for TV series) */
  numberOfSeasons?: number | null;
  /** Number of episodes (for TV series) */
  numberOfEpisodes?: number | null;
  /** Translated genre names */
  genres?: string[];
  /** Average rating string (e.g., "7.5") */
  averageRating?: string | null;
  /** Max number of genres to show */
  maxGenres?: number;
  /** Show media type badge */
  showMediaType?: boolean;
}

/**
 * Reusable movie badges component that displays metadata badges.
 * Use variant='card' for swipe cards (dark background), variant='list' for list items.
 */
export function MovieBadges({
  variant,
  mediaType,
  releaseDate,
  runtime,
  numberOfSeasons,
  numberOfEpisodes,
  genres = [],
  averageRating,
  maxGenres = 2,
  showMediaType = true,
}: MovieBadgesProps) {
  const t = useTranslations('movie');

  // Determine badge variants based on context
  const isCard = variant === 'card';
  const tvBadgeVariant = isCard ? 'cardTv' : 'tv';
  const infoBadgeVariant = isCard ? 'cardSecondary' : 'info';

  // Extract year from release date
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  // Check if we should show seasons/episodes (TV) or runtime (movie)
  const isTv = mediaType === 'tv';
  const hasTvInfo = isTv && (numberOfSeasons || numberOfEpisodes);

  return (
    <>
      {/* Media type badge */}
      {showMediaType && isTv && (
        <Badge variant={tvBadgeVariant}>{t('tvSeries')}</Badge>
      )}
      {showMediaType && !isTv && variant === 'list' && (
        <Badge variant="movie">{t('film')}</Badge>
      )}

      {/* Year */}
      {year && (
        <Badge variant={infoBadgeVariant}>{year}</Badge>
      )}

      {/* Runtime or Seasons/Episodes */}
      {hasTvInfo ? (
        <Badge variant={infoBadgeVariant}>
          {numberOfSeasons ? `${numberOfSeasons}s` : ''}
          {numberOfSeasons && numberOfEpisodes ? ' · ' : ''}
          {numberOfEpisodes ? `${numberOfEpisodes}ep` : ''}
        </Badge>
      ) : runtime ? (
        <Badge variant={infoBadgeVariant}>
          {t('runtime', { minutes: runtime })}
        </Badge>
      ) : null}

      {/* Genres */}
      {genres.slice(0, maxGenres).map((genre) => (
        <Badge key={genre} variant={infoBadgeVariant}>
          {genre}
        </Badge>
      ))}

      {/* Average rating */}
      {averageRating && (
        <Badge variant="rating">{averageRating}</Badge>
      )}
    </>
  );
}
