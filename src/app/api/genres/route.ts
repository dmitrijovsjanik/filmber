import { NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';

export async function GET() {
  try {
    // Fetch both movie and TV genres in both languages
    const [movieGenresEn, movieGenresRu, tvGenresEn, tvGenresRu] = await Promise.all([
      tmdb.getGenres('en-US'),
      tmdb.getGenres('ru-RU'),
      tmdb.getTVGenres('en-US'),
      tmdb.getTVGenres('ru-RU'),
    ]);

    // Merge movie genres with both EN and RU names
    const movieRuMap = new Map(movieGenresRu.map((g) => [g.id, g.name]));
    const movieGenres = movieGenresEn.map((g) => ({
      id: g.id,
      name: g.name,
      nameRu: movieRuMap.get(g.id) || g.name,
      type: 'movie' as const,
    }));

    // Merge TV genres with both EN and RU names
    const tvRuMap = new Map(tvGenresRu.map((g) => [g.id, g.name]));
    const tvGenres = tvGenresEn.map((g) => ({
      id: g.id,
      name: g.name,
      nameRu: tvRuMap.get(g.id) || g.name,
      type: 'tv' as const,
    }));

    return NextResponse.json(
      {
        movie: movieGenres,
        tv: tvGenres,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return NextResponse.json({ movie: [], tv: [] }, { status: 500 });
  }
}
