'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';

interface FilterCounts {
  all: number;
  wantToWatch: number;
  watched: number;
  ratings: Record<number, number>;
}

interface ListFilterProps {
  status: MovieStatus | 'all';
  rating: number | null;
  onStatusChange: (status: MovieStatus | 'all') => void;
  onRatingChange: (rating: number | null) => void;
  counts?: FilterCounts;
}

export function ListFilter({
  status,
  rating,
  onStatusChange,
  onRatingChange,
  counts,
}: ListFilterProps) {
  const t = useTranslations('lists');

  return (
    <div className="flex flex-wrap gap-2">
      {/* Status filter */}
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as MovieStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="all">
            {t('all', { defaultValue: 'All' })}
            {counts?.all !== undefined && (
              <span className="ml-1 opacity-70">{counts.all}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={MOVIE_STATUS.WANT_TO_WATCH}>
            {t('wantToWatch', { defaultValue: 'Want to watch' })}
            {counts?.wantToWatch !== undefined && (
              <span className="ml-1 opacity-70">{counts.wantToWatch}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={MOVIE_STATUS.WATCHED}>
            {t('watched', { defaultValue: 'Watched' })}
            {counts?.watched !== undefined && (
              <span className="ml-1 opacity-70">{counts.watched}</span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Rating filter (only show when viewing watched movies) */}
      {status === MOVIE_STATUS.WATCHED && (
        <Tabs value={rating?.toString() ?? 'any'} onValueChange={(v) => onRatingChange(v === 'any' ? null : Number(v))}>
          <TabsList>
            <TabsTrigger value="any">
              {t('anyRating', { defaultValue: 'Any' })}
            </TabsTrigger>
            <TabsTrigger value="3">
              ⭐️⭐️⭐️
              {counts?.ratings?.[3] !== undefined && (
                <span className="ml-1 opacity-70">{counts.ratings[3]}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="2">
              ⭐️⭐️
              {counts?.ratings?.[2] !== undefined && (
                <span className="ml-1 opacity-70">{counts.ratings[2]}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="1">
              ⭐️
              {counts?.ratings?.[1] !== undefined && (
                <span className="ml-1 opacity-70">{counts.ratings[1]}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
