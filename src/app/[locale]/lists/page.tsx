'use client';

import { useSearchParams } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { MovieListGrid } from '@/components/lists';

export default function ListsPage() {
  const searchParams = useSearchParams();
  const openMovieId = searchParams.get('openMovie');
  const openMovieType = searchParams.get('type') as 'movie' | 'tv' | null;

  return (
    <AuthGuard>
      <div className="flex-1 flex flex-col bg-background py-4 min-h-0 overflow-y-auto overflow-x-visible">
        <div className="flex-1 flex flex-col mx-auto max-w-2xl w-full min-h-0">
          <MovieListGrid
            openMovieId={openMovieId ? parseInt(openMovieId, 10) : undefined}
            openMovieType={openMovieType || undefined}
          />
        </div>
      </div>
    </AuthGuard>
  );
}
