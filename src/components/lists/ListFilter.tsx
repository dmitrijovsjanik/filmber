'use client';

import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { SmileIcon, NeutralIcon, Sad01Icon } from '@hugeicons/core-free-icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { useAnalytics } from '@/hooks/useAnalytics';

// Rating filter config: 1 = sad (red), 2 = neutral (gray), 3 = smile (green)
const ratingFilterConfig = {
  1: { icon: Sad01Icon, color: 'text-red-500', bgColor: 'bg-red-500/20' },
  2: { icon: NeutralIcon, color: 'text-gray-500', bgColor: 'bg-gray-500/20' },
  3: { icon: SmileIcon, color: 'text-green-500', bgColor: 'bg-green-500/20' },
} as const;

// Emoji icon component for filter tabs
function FilterEmoji({ rating }: { rating: 1 | 2 | 3 }) {
  const config = ratingFilterConfig[rating];
  return (
    <HugeiconsIcon
      icon={config.icon}
      size={20}
      className={config.color}
    />
  );
}

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
  const { trackListFilterChanged } = useAnalytics();

  const handleStatusChange = (value: string) => {
    trackListFilterChanged('status', value);
    onStatusChange(value as MovieStatus | 'all');
  };

  const handleRatingChange = (value: string) => {
    const ratingValue = value === 'any' ? null : Number(value);
    trackListFilterChanged('rating', ratingValue);
    onRatingChange(ratingValue);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Status filter */}
      <Tabs value={status} onValueChange={handleStatusChange} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            {t('all', { defaultValue: 'All' })}
            {counts?.all !== undefined && (
              <span className="ml-1 opacity-70">{counts.all}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={MOVIE_STATUS.WANT_TO_WATCH} className="flex-1">
            {t('wantToWatch', { defaultValue: 'Want to watch' })}
            {counts?.wantToWatch !== undefined && (
              <span className="ml-1 opacity-70">{counts.wantToWatch}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={MOVIE_STATUS.WATCHED} className="flex-1">
            {t('watched', { defaultValue: 'Watched' })}
            {counts?.watched !== undefined && (
              <span className="ml-1 opacity-70">{counts.watched}</span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Rating filter (only show when viewing watched movies) */}
      {status === MOVIE_STATUS.WATCHED && (
        <Tabs value={rating?.toString() ?? 'any'} onValueChange={handleRatingChange} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="any" className="flex-1">
              {t('anyRating', { defaultValue: 'Any' })}
            </TabsTrigger>
            <TabsTrigger value="3" className="flex-1">
              <FilterEmoji rating={3} />
              {counts?.ratings?.[3] !== undefined && (
                <span className="ml-1 opacity-70">{counts.ratings[3]}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="2" className="flex-1">
              <FilterEmoji rating={2} />
              {counts?.ratings?.[2] !== undefined && (
                <span className="ml-1 opacity-70">{counts.ratings[2]}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="1" className="flex-1">
              <FilterEmoji rating={1} />
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
