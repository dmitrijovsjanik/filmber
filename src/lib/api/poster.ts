// Poster URL utilities - safe for both client and server
// Separated from tmdb.ts to avoid importing Node.js-only modules on client

// Semantic poster sizes mapping to TMDB sizes
export const POSTER_SIZES = {
  thumbnail: 'w185',    // 185px - for list items, search results
  medium: 'w342',       // 342px - medium displays
  large: 'w500',        // 500px - swipe cards
  hero: 'w780',         // 780px - modal hero images
  original: 'original', // Full resolution
} as const;

export type PosterSize = keyof typeof POSTER_SIZES;
export type TMDBPosterSize = typeof POSTER_SIZES[PosterSize];

/**
 * Build poster URL - uses proxy endpoint on server to bypass geo-blocking
 * Accepts semantic sizes (thumbnail, medium, large, hero) or direct TMDB sizes (w185, w342, etc)
 */
export function getPosterUrl(
  path: string | null,
  size: PosterSize | TMDBPosterSize = 'medium'
): string {
  if (!path) return '/images/no-poster.svg';
  // Convert semantic size to TMDB size if needed
  const tmdbSize = size in POSTER_SIZES
    ? POSTER_SIZES[size as PosterSize]
    : size;
  // Use proxy endpoint to route through server's v2ray
  return `/api/tmdb-image?path=${encodeURIComponent(path)}&size=${tmdbSize}`;
}

/**
 * Build backdrop URL - uses proxy endpoint on server to bypass geo-blocking
 */
export function getBackdropUrl(
  path: string | null,
  size: 'w780' | 'w1280' | 'original' = 'w1280'
): string {
  if (!path) return '/images/no-backdrop.png';
  return `/api/tmdb-image?path=${encodeURIComponent(path)}&size=${size}`;
}
