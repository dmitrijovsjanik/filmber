'use client';

import { AuthGuard } from '@/components/auth';
import { MovieListGrid } from '@/components/lists';

export default function ListsPage() {
  return (
    <AuthGuard>
      <div className="flex-1 flex flex-col bg-background p-4 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col mx-auto max-w-2xl w-full min-h-0 overflow-hidden">
          <MovieListGrid />
        </div>
      </div>
    </AuthGuard>
  );
}
