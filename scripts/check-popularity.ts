/**
 * Check popularity of specific movies to determine threshold
 * Usage: npx tsx scripts/check-popularity.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

interface MovieDetails {
  id: number;
  title: string;
  original_title: string;
  popularity: number;
  vote_count: number;
  vote_average: number;
  overview: string;
  release_date: string;
}

async function fetchMovie(tmdbId: number, language: string): Promise<MovieDetails | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?language=${language}`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function main() {
  if (!TMDB_ACCESS_TOKEN) {
    console.error('TMDB_ACCESS_TOKEN not set');
    process.exit(1);
  }

  // Movies to check - user examples + popular upcoming
  const movieIds = [
    1379520, 1168719, 1464883, 1284496,  // User examples (low popularity)
    1064028,  // Балерина (известный)
    698687,   // Трансформеры: Один
    939243,   // Соник 3
    1241982,  // Мстители: Doomsday
  ];

  console.log('Checking movie popularity...\n');
  console.log('─'.repeat(80));

  for (const id of movieIds) {
    const enData = await fetchMovie(id, 'en-US');
    const ruData = await fetchMovie(id, 'ru-RU');

    if (!enData) {
      console.log(`❌ Movie ${id}: Not found`);
      continue;
    }

    const hasRussian = ruData && ruData.title !== enData.original_title && ruData.overview !== '';

    console.log(`\n📽️  TMDB ID: ${id}`);
    console.log(`   Title (EN): ${enData.title}`);
    console.log(`   Title (RU): ${ruData?.title || 'N/A'}`);
    console.log(`   ⭐ Popularity: ${enData.popularity.toFixed(2)}`);
    console.log(`   🗳️  Votes: ${enData.vote_count} (${enData.vote_average}/10)`);
    console.log(`   📅 Release: ${enData.release_date}`);
    console.log(`   🇷🇺 Has Russian: ${hasRussian ? '✅ YES' : '❌ NO'}`);
    console.log(`   📝 RU Overview: ${ruData?.overview ? `${ruData.overview.substring(0, 100)}...` : 'N/A'}`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log('\n📊 Summary:');
  console.log('   Movies with RU translation typically have popularity > X');
  console.log('   Use this data to set the minPopularity threshold in admin panel');
}

main();
