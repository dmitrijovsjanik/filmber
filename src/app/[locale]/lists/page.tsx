'use client';

import { AuthGuard } from '@/components/auth';
import { MovieListGrid } from '@/components/lists';

export default function ListsPage() {
  return (
    <AuthGuard>
      <div className="flex-1 flex flex-col bg-background py-4 min-h-0 overflow-y-auto overflow-x-visible">
        <div className="flex-1 flex flex-col mx-auto max-w-2xl w-full min-h-0">
          <MovieListGrid />
        </div>
      </div>
    </AuthGuard>
  );
}
