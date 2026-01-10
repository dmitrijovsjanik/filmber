'use client';

import { useTranslations } from 'next-intl';
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
      <div className="flex rounded-lg bg-gray-800 p-1">
        <FilterButton
          active={status === 'all'}
          onClick={() => onStatusChange('all')}
          count={counts?.all}
        >
          {t('all', { defaultValue: 'All' })}
        </FilterButton>
        <FilterButton
          active={status === MOVIE_STATUS.WANT_TO_WATCH}
          onClick={() => onStatusChange(MOVIE_STATUS.WANT_TO_WATCH)}
          count={counts?.wantToWatch}
        >
          {t('wantToWatch', { defaultValue: 'Want to watch' })}
        </FilterButton>
        <FilterButton
          active={status === MOVIE_STATUS.WATCHED}
          onClick={() => onStatusChange(MOVIE_STATUS.WATCHED)}
          count={counts?.watched}
        >
          {t('watched', { defaultValue: 'Watched' })}
        </FilterButton>
      </div>

      {/* Rating filter (only show when viewing watched movies) */}
      {status === MOVIE_STATUS.WATCHED && (
        <div className="flex rounded-lg bg-gray-800 p-1">
          <FilterButton active={rating === null} onClick={() => onRatingChange(null)}>
            {t('anyRating', { defaultValue: 'Any' })}
          </FilterButton>
          <FilterButton
            active={rating === 3}
            onClick={() => onRatingChange(3)}
            count={counts?.ratings?.[3]}
          >
            ⭐️⭐️⭐️
          </FilterButton>
          <FilterButton
            active={rating === 2}
            onClick={() => onRatingChange(2)}
            count={counts?.ratings?.[2]}
          >
            ⭐️⭐️
          </FilterButton>
          <FilterButton
            active={rating === 1}
            onClick={() => onRatingChange(1)}
            count={counts?.ratings?.[1]}
          >
            ⭐️
          </FilterButton>
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className="ml-1 text-xs opacity-70">({count})</span>
      )}
    </button>
  );
}
