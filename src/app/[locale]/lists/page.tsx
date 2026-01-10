'use client';

import { useTranslations } from 'next-intl';
import { AuthGuard } from '@/components/auth';
import { MovieListGrid } from '@/components/lists';

export default function ListsPage() {
  const t = useTranslations('lists');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-white">
              {t('myLists', { defaultValue: 'My Movie Lists' })}
            </h1>
            <p className="mt-1 text-gray-400">
              {t('listsDescription', {
                defaultValue: 'Track movies you want to watch and rate the ones you watched',
              })}
            </p>
          </header>

          {/* Movie list grid */}
          <MovieListGrid />
        </div>
      </div>
    </AuthGuard>
  );
}
