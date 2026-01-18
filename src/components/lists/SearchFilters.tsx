'use client';

import { memo, useCallback } from 'react';
import { SortMenu } from '@/components/molecules/SortMenu';
import { FiltersMenu } from '@/components/molecules/FiltersMenu';
import { QuickFilters } from '@/components/molecules/QuickFilters';
import type { SearchFilters as Filters, SortOption } from '@/types/movie';

interface SearchFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  locale: string;
  disabled?: boolean;
}

export const SearchFilters = memo(function SearchFilters({
  filters,
  onFiltersChange,
  locale,
  disabled = false,
}: SearchFiltersProps) {
  const handleSortChange = useCallback(
    (value: SortOption) => {
      onFiltersChange({ ...filters, sortBy: value });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-4">
      <SortMenu
        value={filters.sortBy}
        onChange={handleSortChange}
        disabled={disabled}
      />
      <FiltersMenu
        filters={filters}
        onFiltersChange={onFiltersChange}
        locale={locale}
        disabled={disabled}
      />
      <QuickFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        locale={locale}
        disabled={disabled}
      />
    </div>
  );
});
