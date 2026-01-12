'use client';

import { useCallback } from 'react';
import { SortMenu } from '@/components/molecules/SortMenu';
import { FiltersMenu } from '@/components/molecules/FiltersMenu';
import type { SearchFilters as Filters, SortOption } from '@/types/movie';

interface SearchFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  locale: string;
  disabled?: boolean;
}

export function SearchFilters({
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
    <div className="flex items-center gap-2">
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
    </div>
  );
}
