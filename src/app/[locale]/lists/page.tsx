'use client';

import { AuthGuard } from '@/components/auth';
import { MovieListGrid } from '@/components/lists';

export default function ListsPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <MovieListGrid />
        </div>
      </div>
    </AuthGuard>
  );
}
