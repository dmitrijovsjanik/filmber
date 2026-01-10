'use client';

import { useTranslations } from 'next-intl';

interface SearchServiceTabsProps {
  activeService: 'tmdb' | 'omdb';
  tmdbCount: number;
  omdbCount: number;
  onServiceChange: (service: 'tmdb' | 'omdb') => void;
  isSearching?: boolean;
}

export function SearchServiceTabs({
  activeService,
  tmdbCount,
  omdbCount,
  onServiceChange,
  isSearching = false,
}: SearchServiceTabsProps) {
  const t = useTranslations('lists');

  return (
    <div className="flex rounded-lg bg-gray-800 p-1">
      <button
        onClick={() => onServiceChange('tmdb')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeService === 'tmdb'
            ? 'bg-emerald-600 text-white'
            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
      >
        {t('searchTmdb', { defaultValue: 'TMDB' })}
        <span className="ml-1 text-xs opacity-70">
          ({isSearching ? '...' : tmdbCount})
        </span>
      </button>
      <button
        onClick={() => onServiceChange('omdb')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          activeService === 'omdb'
            ? 'bg-emerald-600 text-white'
            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
      >
        {t('searchOmdb', { defaultValue: 'OMDB' })}
        <span className="ml-1 text-xs opacity-70">
          ({isSearching ? '...' : omdbCount})
        </span>
      </button>
    </div>
  );
}
