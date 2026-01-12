/**
 * Calculate average rating from multiple platform ratings.
 * Handles both MovieRatings object and individual rating strings.
 */

import type { MovieRatings } from '@/types/movie';

interface RatingValues {
  tmdb?: string | null;
  imdb?: string | null;
  kinopoisk?: string | null;
  rottenTomatoes?: string | null;
}

/**
 * Parse a rating string to number, handling edge cases.
 * Returns null for invalid, empty, or zero values.
 */
function parseRating(value: string | null | undefined): number | null {
  if (!value || value === '0') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate the average rating from multiple sources.
 * Returns formatted string (e.g., "7.5") or null if no valid ratings.
 */
export function calculateAverageRating(ratings: RatingValues | MovieRatings): string | null {
  const values: number[] = [];

  const tmdb = parseRating(ratings.tmdb);
  if (tmdb !== null) values.push(tmdb);

  const imdb = parseRating(ratings.imdb);
  if (imdb !== null) values.push(imdb);

  const kinopoisk = parseRating(ratings.kinopoisk);
  if (kinopoisk !== null) values.push(kinopoisk);

  const rottenTomatoes = parseRating(ratings.rottenTomatoes);
  if (rottenTomatoes !== null) values.push(rottenTomatoes);

  if (values.length === 0) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return avg.toFixed(1);
}

/**
 * Calculate average rating from individual rating strings.
 * Convenience function for components with separate rating props.
 */
export function calculateAverageRatingFromStrings(
  tmdb?: string | null,
  imdb?: string | null,
  kinopoisk?: string | null,
  rottenTomatoes?: string | null
): string | null {
  return calculateAverageRating({ tmdb, imdb, kinopoisk, rottenTomatoes });
}
