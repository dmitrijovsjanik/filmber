'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';

export type SearchService = 'tmdb' | 'omdb' | 'kinopoisk';

interface SourceStatus {
  tmdb: boolean;
  omdb: boolean;
  kinopoisk: boolean;
}

interface SearchServiceTabsProps {
  activeService: SearchService;
  tmdbCount: number;
  omdbCount: number;
  kinopoiskCount: number;
  onServiceChange: (service: SearchService) => void;
  isSearching?: boolean;
  sourceStatus?: SourceStatus;
}

export function SearchServiceTabs({
  activeService,
  tmdbCount,
  omdbCount,
  kinopoiskCount,
  onServiceChange,
  isSearching = false,
  sourceStatus = { tmdb: true, omdb: true, kinopoisk: true },
}: SearchServiceTabsProps) {
  const t = useTranslations('lists');

  return (
    <Tabs value={activeService} onValueChange={(v) => onServiceChange(v as SearchService)}>
      <TabsList>
        <TabsTrigger value="tmdb" className="relative">
          {!sourceStatus.tmdb && (
            <HugeiconsIcon icon={AlertCircleIcon} size={12} className="text-yellow-500 mr-1" />
          )}
          {t('searchTmdb', { defaultValue: 'TMDB' })}
          <span className="ml-1 opacity-70">
            {isSearching ? '...' : tmdbCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="kinopoisk" className="relative">
          {!sourceStatus.kinopoisk && (
            <HugeiconsIcon icon={AlertCircleIcon} size={12} className="text-yellow-500 mr-1" />
          )}
          {t('searchKinopoisk', { defaultValue: 'Kinopoisk' })}
          <span className="ml-1 opacity-70">
            {isSearching ? '...' : kinopoiskCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="omdb" className="relative">
          {!sourceStatus.omdb && (
            <HugeiconsIcon icon={AlertCircleIcon} size={12} className="text-yellow-500 mr-1" />
          )}
          {t('searchOmdb', { defaultValue: 'OMDB' })}
          <span className="ml-1 opacity-70">
            {isSearching ? '...' : omdbCount}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
