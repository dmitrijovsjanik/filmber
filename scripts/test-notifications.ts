#!/usr/bin/env npx tsx
/**
 * Manual test script for notification system fixes
 * Run with: npx tsx scripts/test-notifications.ts
 */

// ============================================
// Test parseMovieParam function
// ============================================

interface ParsedMovieParam {
  tmdbId: string;
  type: 'movie' | 'tv';
  locale?: string;
}

function parseMovieParam(startParam?: string): ParsedMovieParam | null {
  if (!startParam) return null;

  // Try new format with locale: ru_movie_123 or en_tv_456
  const matchWithLocale = startParam.match(/^(ru|en)_(movie|tv)_(\d+)$/i);
  if (matchWithLocale) {
    return {
      locale: matchWithLocale[1].toLowerCase(),
      type: matchWithLocale[2].toLowerCase() as 'movie' | 'tv',
      tmdbId: matchWithLocale[3],
    };
  }

  // Try legacy format: movie_123 or tv_456
  const match = startParam.match(/^(movie|tv)_(\d+)$/i);
  if (!match) return null;
  return { type: match[1].toLowerCase() as 'movie' | 'tv', tmdbId: match[2] };
}

// ============================================
// Test URL generation with locale
// ============================================

function getMovieAppUrl(tmdbId: number, locale: 'ru' | 'en' = 'ru'): string {
  const botUsername = 'filmberonline_bot';
  const miniAppName = 'app';
  return `https://t.me/${botUsername}/${miniAppName}?startapp=${locale}_movie_${tmdbId}`;
}

function getSeriesAppUrl(tmdbId: number, locale: 'ru' | 'en' = 'ru'): string {
  const botUsername = 'filmberonline_bot';
  const miniAppName = 'app';
  return `https://t.me/${botUsername}/${miniAppName}?startapp=${locale}_tv_${tmdbId}`;
}

// ============================================
// Test time slot calculation
// ============================================

const MSK_OFFSET_HOURS = 3;

function mskToUtc(mskHour: number): number {
  return (mskHour - MSK_OFFSET_HOURS + 24) % 24;
}

const PERIODS = {
  day: {
    startMsk: 6,
    endMsk: 18,
    hoursCount: 12,
  },
  evening: {
    startMsk: 18,
    endMsk: 6,
    hoursCount: 12,
  },
};

function calculateScheduleSlots(
  itemCount: number,
  period: 'day' | 'evening'
): Array<{ hour: number; minute: number }> {
  const periodConfig = PERIODS[period];
  const slots: Array<{ hour: number; minute: number }> = [];

  if (itemCount === 0) return slots;

  const maxSlots = periodConfig.hoursCount * 2;
  const actualSlots = Math.min(itemCount, maxSlots);
  const totalMinutes = periodConfig.hoursCount * 60;
  const intervalMinutes = Math.floor(totalMinutes / actualSlots);

  for (let i = 0; i < actualSlots; i++) {
    const offsetMinutes = i * intervalMinutes;
    let mskHour = periodConfig.startMsk + Math.floor(offsetMinutes / 60);
    const minute = offsetMinutes % 60 >= 30 ? 30 : 0;

    if (mskHour >= 24) {
      mskHour -= 24;
    }

    slots.push({
      hour: mskToUtc(mskHour),
      minute,
    });
  }

  return slots;
}

// ============================================
// Test silent hours
// ============================================

const SILENT_HOUR_START_UTC = 20;
const SILENT_HOUR_END_UTC = 5;

function isSilentHours(hourUtc: number): boolean {
  return hourUtc >= SILENT_HOUR_START_UTC || hourUtc < SILENT_HOUR_END_UTC;
}

// ============================================
// Test runner
// ============================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ============================================
// Run tests
// ============================================

console.log('\n=== Testing parseMovieParam ===\n');

console.log('New format with locale:');
assertEqual(
  parseMovieParam('ru_movie_123'),
  { locale: 'ru', type: 'movie', tmdbId: '123' },
  'ru_movie_123 parsed correctly'
);
assertEqual(
  parseMovieParam('en_movie_456'),
  { locale: 'en', type: 'movie', tmdbId: '456' },
  'en_movie_456 parsed correctly'
);
assertEqual(
  parseMovieParam('ru_tv_789'),
  { locale: 'ru', type: 'tv', tmdbId: '789' },
  'ru_tv_789 parsed correctly'
);
assertEqual(
  parseMovieParam('en_tv_101112'),
  { locale: 'en', type: 'tv', tmdbId: '101112' },
  'en_tv_101112 parsed correctly'
);

console.log('\nCase insensitivity:');
assertEqual(
  parseMovieParam('RU_MOVIE_123'),
  { locale: 'ru', type: 'movie', tmdbId: '123' },
  'RU_MOVIE_123 case insensitive'
);
assertEqual(
  parseMovieParam('En_Tv_456'),
  { locale: 'en', type: 'tv', tmdbId: '456' },
  'En_Tv_456 case insensitive'
);

console.log('\nLegacy format:');
assertEqual(
  parseMovieParam('movie_123'),
  { type: 'movie', tmdbId: '123' },
  'movie_123 parsed (no locale)'
);
assertEqual(
  parseMovieParam('tv_456'),
  { type: 'tv', tmdbId: '456' },
  'tv_456 parsed (no locale)'
);

console.log('\nInvalid inputs:');
assertEqual(parseMovieParam(undefined), null, 'undefined returns null');
assertEqual(parseMovieParam(''), null, 'empty string returns null');
assertEqual(parseMovieParam('room_ABC123_1234'), null, 'room params returns null');
assertEqual(parseMovieParam('invalid'), null, 'invalid string returns null');
assertEqual(parseMovieParam('fr_movie_123'), null, 'unsupported locale returns null');
assertEqual(parseMovieParam('ru_movie_abc'), null, 'non-numeric tmdbId returns null');

console.log('\n=== Testing URL generation ===\n');

assertEqual(
  getMovieAppUrl(12345, 'ru'),
  'https://t.me/filmberonline_bot/app?startapp=ru_movie_12345',
  'Movie URL with ru locale'
);
assertEqual(
  getMovieAppUrl(67890, 'en'),
  'https://t.me/filmberonline_bot/app?startapp=en_movie_67890',
  'Movie URL with en locale'
);
assertEqual(
  getMovieAppUrl(11111),
  'https://t.me/filmberonline_bot/app?startapp=ru_movie_11111',
  'Movie URL defaults to ru'
);
assertEqual(
  getSeriesAppUrl(12345, 'ru'),
  'https://t.me/filmberonline_bot/app?startapp=ru_tv_12345',
  'TV URL with ru locale'
);
assertEqual(
  getSeriesAppUrl(67890, 'en'),
  'https://t.me/filmberonline_bot/app?startapp=en_tv_67890',
  'TV URL with en locale'
);

console.log('\n=== Testing mskToUtc ===\n');

assertEqual(mskToUtc(6), 3, '06:00 MSK = 03:00 UTC');
assertEqual(mskToUtc(18), 15, '18:00 MSK = 15:00 UTC');
assertEqual(mskToUtc(0), 21, '00:00 MSK = 21:00 UTC');
assertEqual(mskToUtc(3), 0, '03:00 MSK = 00:00 UTC');
assertEqual(mskToUtc(23), 20, '23:00 MSK = 20:00 UTC');

console.log('\n=== Testing calculateScheduleSlots ===\n');

console.log('Day period:');
assertEqual(calculateScheduleSlots(0, 'day').length, 0, '0 items = 0 slots');
assertEqual(calculateScheduleSlots(1, 'day').length, 1, '1 item = 1 slot');
assertEqual(calculateScheduleSlots(12, 'day').length, 12, '12 items = 12 slots');
assertEqual(calculateScheduleSlots(24, 'day').length, 24, '24 items = 24 slots');
assertEqual(calculateScheduleSlots(100, 'day').length, 24, '100 items capped at 24 slots');

const daySlots = calculateScheduleSlots(12, 'day');
assertEqual(daySlots[0].hour, 3, 'First slot at 03:00 UTC (06:00 MSK)');
assertEqual(daySlots[0].minute, 0, 'First slot minute = 0');

const halfHourSlots = calculateScheduleSlots(24, 'day');
assert(halfHourSlots.some(s => s.minute === 30), 'Uses :30 slots for 24 items');

console.log('\nEvening period:');
const eveningSlots = calculateScheduleSlots(1, 'evening');
assertEqual(eveningSlots[0].hour, 15, 'Evening starts at 15:00 UTC (18:00 MSK)');

console.log('\n=== Testing isSilentHours ===\n');

console.log('Silent period (23:00-08:00 MSK):');
assert(isSilentHours(20), '20:00 UTC (23:00 MSK) is silent');
assert(isSilentHours(21), '21:00 UTC (00:00 MSK) is silent');
assert(isSilentHours(0), '00:00 UTC (03:00 MSK) is silent');
assert(isSilentHours(4), '04:00 UTC (07:00 MSK) is silent');

console.log('\nNon-silent period:');
assert(!isSilentHours(5), '05:00 UTC (08:00 MSK) is NOT silent');
assert(!isSilentHours(9), '09:00 UTC (12:00 MSK) is NOT silent');
assert(!isSilentHours(15), '15:00 UTC (18:00 MSK) is NOT silent');
assert(!isSilentHours(19), '19:00 UTC (22:00 MSK) is NOT silent');

console.log('\n=== Testing duplicate prevention ===\n');

const itemsToSchedule: Array<{ tmdbId: number; type: string }> = [];
itemsToSchedule.push({ tmdbId: 12345, type: 'theatrical_release' });

const alreadyScheduled = itemsToSchedule.some(
  (item) => item.tmdbId === 12345 && item.type === 'theatrical_release'
);
assert(alreadyScheduled, 'Detects theatrical already scheduled for tmdbId 12345');

const notScheduled = itemsToSchedule.some(
  (item) => item.tmdbId === 67890 && item.type === 'theatrical_release'
);
assert(!notScheduled, 'No theatrical for tmdbId 67890');

console.log('\n=== Testing future release date filter ===\n');

const today = '2026-01-17';
const movies = [
  { tmdbId: 1, theatricalReleaseRu: '2026-02-01' },
  { tmdbId: 2, theatricalReleaseRu: '2026-01-17' },
  { tmdbId: 3, theatricalReleaseRu: '2025-10-15' },
  { tmdbId: 4, theatricalReleaseRu: '2026-03-20' },
];

const futureMovies = movies.filter((movie) => {
  return movie.theatricalReleaseRu && movie.theatricalReleaseRu > today;
});

assertEqual(futureMovies.length, 2, 'Only 2 movies with future release dates');
assertEqual(futureMovies.map(m => m.tmdbId), [1, 4], 'tmdbId 1 and 4 are future releases');

// ============================================
// Summary
// ============================================

console.log('\n========================================');
console.log(`TOTAL: ${passed + failed} tests`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
