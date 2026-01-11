'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <Tabs value={activeService} onValueChange={(v) => onServiceChange(v as 'tmdb' | 'omdb')}>
      <TabsList>
        <TabsTrigger value="tmdb">
          {t('searchTmdb', { defaultValue: 'TMDB' })}
          <span className="ml-1 opacity-70">
            {isSearching ? '...' : tmdbCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="omdb">
          {t('searchOmdb', { defaultValue: 'OMDB' })}
          <span className="ml-1 opacity-70">
            {isSearching ? '...' : omdbCount}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
