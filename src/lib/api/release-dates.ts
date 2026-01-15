import type { TMDBReleaseDates, ParsedReleaseDates, TMDBReleaseType } from '@/types/movie';

// TMDB Release Types
const RELEASE_TYPE = {
  PREMIERE: 1,
  THEATRICAL_LIMITED: 2,
  THEATRICAL: 3,
  DIGITAL: 4,
  PHYSICAL: 5,
  TV: 6,
} as const;

/**
 * Parse TMDB release dates response into a simplified format
 * Extracts theatrical and digital release dates for US and RU regions
 */
export function parseReleaseDates(data: TMDBReleaseDates): ParsedReleaseDates {
  const result: ParsedReleaseDates = {
    theatricalUs: null,
    theatricalRu: null,
    digitalUs: null,
    digitalRu: null,
  };

  for (const country of data.results) {
    const dates = country.release_dates;

    // Find theatrical release (prefer wide release type 3, fallback to limited type 2)
    const theatrical =
      dates.find((d) => d.type === RELEASE_TYPE.THEATRICAL) ||
      dates.find((d) => d.type === RELEASE_TYPE.THEATRICAL_LIMITED) ||
      dates.find((d) => d.type === RELEASE_TYPE.PREMIERE);

    // Find digital release (type 4)
    const digital = dates.find((d) => d.type === RELEASE_TYPE.DIGITAL);

    // Extract date in YYYY-MM-DD format
    const extractDate = (releaseDate: string | undefined): string | null => {
      if (!releaseDate) return null;
      return releaseDate.split('T')[0] || null;
    };

    if (country.iso_3166_1 === 'US') {
      result.theatricalUs = extractDate(theatrical?.release_date);
      result.digitalUs = extractDate(digital?.release_date);
    }

    if (country.iso_3166_1 === 'RU') {
      result.theatricalRu = extractDate(theatrical?.release_date);
      result.digitalRu = extractDate(digital?.release_date);
    }
  }

  return result;
}

/**
 * Estimate digital release date based on theatrical release
 * Typically movies become available digitally ~90 days after theatrical release
 */
export function estimateDigitalRelease(theatricalDate: string | null): string | null {
  if (!theatricalDate) return null;

  const date = new Date(theatricalDate);
  if (isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0];
}

/**
 * Get the primary release date (earliest theatrical release between US and RU)
 */
export function getPrimaryReleaseDate(parsed: ParsedReleaseDates): string | null {
  const dates = [parsed.theatricalUs, parsed.theatricalRu].filter(Boolean) as string[];

  if (dates.length === 0) return null;

  // Return the earliest date
  return dates.sort()[0];
}

/**
 * Get the best available digital release date
 * Priority: actual digital date > estimated from theatrical
 */
export function getDigitalReleaseDate(parsed: ParsedReleaseDates): string | null {
  // If we have an actual digital release date, use it
  const actualDigital = parsed.digitalUs || parsed.digitalRu;
  if (actualDigital) return actualDigital;

  // Otherwise estimate from theatrical release
  const theatrical = getPrimaryReleaseDate(parsed);
  return estimateDigitalRelease(theatrical);
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date >= today;
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if a date was N days ago or more
 */
export function isDaysAgo(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  targetDate.setHours(0, 0, 0, 0);

  return date <= targetDate;
}

/**
 * Format date for display (localized)
 */
export function formatReleaseDate(dateInput: string | Date | null, locale: 'en' | 'ru' = 'en'): string {
  if (!dateInput) return locale === 'ru' ? 'Дата неизвестна' : 'Date unknown';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return locale === 'ru' ? 'Дата неизвестна' : 'Date unknown';

  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get release type name for display
 */
export function getReleaseTypeName(type: TMDBReleaseType, locale: 'en' | 'ru' = 'en'): string {
  const names = {
    1: { en: 'Premiere', ru: 'Премьера' },
    2: { en: 'Theatrical (Limited)', ru: 'Ограниченный прокат' },
    3: { en: 'Theatrical', ru: 'В кинотеатрах' },
    4: { en: 'Digital', ru: 'Цифровой релиз' },
    5: { en: 'Physical', ru: 'Физический носитель' },
    6: { en: 'TV', ru: 'ТВ-премьера' },
  };

  return names[type]?.[locale] || (locale === 'ru' ? 'Неизвестно' : 'Unknown');
}
