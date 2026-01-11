import { NextResponse } from 'next/server';
import { tmdb } from '@/lib/api/tmdb';

export async function GET() {
  try {
    const [genresEn, genresRu] = await Promise.all([
      tmdb.getGenres('en-US'),
      tmdb.getGenres('ru-RU'),
    ]);

    // Merge genres with both EN and RU names
    const ruMap = new Map(genresRu.map((g) => [g.id, g.name]));
    const genres = genresEn.map((g) => ({
      id: g.id,
      name: g.name,
      nameRu: ruMap.get(g.id) || g.name,
    }));

    return NextResponse.json(genres, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    return NextResponse.json([], { status: 500 });
  }
}
