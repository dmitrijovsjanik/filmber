import { useMemo } from 'react';
import { translateGenres } from '@/lib/genres';

// Module-level cache for parsed genres to avoid repeated JSON.parse
const genreParseCache = new Map<string, string[]>();

/**
 * Parse genres JSON string with caching
 * Handles both formats:
 * - Array of strings: ["Action", "Drama"]
 * - Array of objects: [{ name: "Action" }, { name: "Drama" }]
 */
function parseGenresString(genresJson: string | null): string[] {
  if (!genresJson) return [];

  // Return cached result if available
  const cached = genreParseCache.get(genresJson);
  if (cached) return cached;

  try {
    const parsed = JSON.parse(genresJson);
    let result: string[] = [];

    if (Array.isArray(parsed) && parsed.length > 0) {
      // Check if it's array of objects with 'name' property
      if (typeof parsed[0] === 'object' && parsed[0] !== null && 'name' in parsed[0]) {
        result = parsed.map((g: { name: string }) => g.name);
      } else {
        // Assume it's array of strings
        result = parsed;
      }
    }

    // LRU-like cache limit to prevent memory issues
    if (genreParseCache.size > 500) {
      const firstKey = genreParseCache.keys().next().value;
      if (firstKey) genreParseCache.delete(firstKey);
    }
    genreParseCache.set(genresJson, result);

    return result;
  } catch {
    return [];
  }
}

/**
 * Hook for memoized genre parsing and translation
 * Parses genre JSON string once and caches the result
 *
 * @param genresJson - JSON string of genres from database
 * @param locale - Current locale for translation (en/ru)
 * @returns Array of translated genre names
 */
export function useGenres(genresJson: string | null, locale: string): string[] {
  return useMemo(() => {
    const rawGenres = parseGenresString(genresJson);
    return translateGenres(rawGenres, locale);
  }, [genresJson, locale]);
}

/**
 * Non-hook version for use outside React components
 */
export function getTranslatedGenres(genresJson: string | null, locale: string): string[] {
  const rawGenres = parseGenresString(genresJson);
  return translateGenres(rawGenres, locale);
}
