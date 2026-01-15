/**
 * Analyze popularity distribution of upcoming movies from TMDB
 * Usage: npx tsx scripts/check-upcoming-distribution.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

interface UpcomingResponse {
  results: Array<{
    id: number;
    title: string;
    popularity: number;
    release_date: string;
    vote_count: number;
  }>;
  total_results: number;
  total_pages: number;
}

async function fetchUpcoming(page: number, region: string): Promise<UpcomingResponse | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/upcoming?language=en-US&page=${page}&region=${region}`,
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

async function checkRussian(tmdbId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?language=ru-RU`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.overview && data.overview.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  if (!TMDB_ACCESS_TOKEN) {
    console.error('TMDB_ACCESS_TOKEN not set');
    process.exit(1);
  }

  console.log('📊 Analyzing upcoming movies distribution...\n');

  // Fetch 3 pages from both US and RU regions
  const allMovies = new Map<number, { title: string; popularity: number; release_date: string }>();

  for (const region of ['US', 'RU']) {
    for (let page = 1; page <= 3; page++) {
      const data = await fetchUpcoming(page, region);
      if (data) {
        for (const movie of data.results) {
          if (!allMovies.has(movie.id)) {
            allMovies.set(movie.id, {
              title: movie.title,
              popularity: movie.popularity,
              release_date: movie.release_date,
            });
          }
        }
      }
    }
  }

  const movies = Array.from(allMovies.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.popularity - a.popularity);

  console.log(`Total unique upcoming movies: ${movies.length}\n`);

  // Popularity distribution
  const ranges = [
    { min: 100, max: Infinity, label: '100+' },
    { min: 50, max: 100, label: '50-100' },
    { min: 20, max: 50, label: '20-50' },
    { min: 10, max: 20, label: '10-20' },
    { min: 5, max: 10, label: '5-10' },
    { min: 0, max: 5, label: '0-5' },
  ];

  console.log('Popularity Distribution:');
  console.log('─'.repeat(50));

  for (const range of ranges) {
    const count = movies.filter(m => m.popularity >= range.min && m.popularity < range.max).length;
    const bar = '█'.repeat(Math.min(count, 30));
    console.log(`${range.label.padStart(7)}: ${String(count).padStart(3)} ${bar}`);
  }

  // Check Russian availability for sample movies
  console.log('\n\n📝 Checking Russian availability for sample movies...\n');
  console.log('─'.repeat(80));

  // Sample: top 5, middle 5, bottom 5
  const samples = [
    ...movies.slice(0, 5),
    ...movies.slice(Math.floor(movies.length / 2) - 2, Math.floor(movies.length / 2) + 3),
    ...movies.slice(-5),
  ];

  for (const movie of samples) {
    const hasRu = await checkRussian(movie.id);
    const ruIcon = hasRu ? '✅' : '❌';
    console.log(
      `${ruIcon} Pop: ${movie.popularity.toFixed(1).padStart(6)} | ${movie.title.substring(0, 40).padEnd(40)} | ${movie.release_date}`
    );
  }

  // Recommendations
  console.log('\n\n💡 Recommendations:');
  console.log('─'.repeat(50));

  const withRussianThreshold = movies.filter(m => m.popularity >= 10).length;
  const withoutShlag = movies.filter(m => m.popularity >= 5).length;

  console.log(`\nAt popularity >= 50: ${movies.filter(m => m.popularity >= 50).length} movies`);
  console.log(`At popularity >= 20: ${movies.filter(m => m.popularity >= 20).length} movies`);
  console.log(`At popularity >= 10: ${movies.filter(m => m.popularity >= 10).length} movies`);
  console.log(`At popularity >= 5:  ${movies.filter(m => m.popularity >= 5).length} movies`);
}

main();
