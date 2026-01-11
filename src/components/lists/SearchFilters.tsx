'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpDown, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { SearchFilters as Filters, SortOption } from '@/types/movie';

interface Genre {
  id: number;
  name: string;
  nameRu: string;
}

interface SearchFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  locale: string;
  disabled?: boolean;
}

const SORT_OPTIONS: SortOption[] = ['relevance', 'popularity', 'rating', 'date_desc', 'date_asc'];

export function SearchFilters({
  filters,
  onFiltersChange,
  locale,
  disabled = false,
}: SearchFiltersProps) {
  const t = useTranslations('search');
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      setIsLoadingGenres(true);
      try {
        const response = await fetch('/api/genres');
        const data = await response.json();
        setAllGenres(data);
      } catch (error) {
        console.error('Failed to fetch genres:', error);
      } finally {
        setIsLoadingGenres(false);
      }
    };
    fetchGenres();
  }, []);

  const handleGenresChange = useCallback(
    (values: string[]) => {
      const genreIds = values.map(Number);
      onFiltersChange({ ...filters, genres: genreIds });
    },
    [filters, onFiltersChange]
  );

  const handleSortChange = useCallback(
    (value: SortOption) => {
      onFiltersChange({ ...filters, sortBy: value });
      setSortSheetOpen(false);
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({
      genres: [],
      yearFrom: null,
      yearTo: null,
      ratingMin: null,
      sortBy: filters.sortBy,
    });
  }, [filters.sortBy, onFiltersChange]);

  const activeFiltersCount =
    filters.genres.length +
    (filters.yearFrom ? 1 : 0) +
    (filters.yearTo ? 1 : 0) +
    (filters.ratingMin ? 1 : 0);

  const getSortLabel = (option: SortOption) => {
    const labels: Record<SortOption, string> = {
      relevance: t('sortRelevance'),
      popularity: t('sortPopularity'),
      rating: t('sortRating'),
      date_desc: t('sortNewest'),
      date_asc: t('sortOldest'),
    };
    return labels[option];
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sort button */}
      <Sheet open={sortSheetOpen} onOpenChange={setSortSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2 h-9 px-3"
          >
            <ArrowUpDown className="h-4 w-4" />
            {getSortLabel(filters.sortBy)}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{t('sortBy')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {SORT_OPTIONS.map((option) => (
              <Button
                key={option}
                variant="ghost"
                onClick={() => handleSortChange(option)}
                className="flex items-center justify-between w-full h-12 px-3"
              >
                <span className={filters.sortBy === option ? 'font-medium' : 'font-normal'}>
                  {getSortLabel(option)}
                </span>
                {filters.sortBy === option && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Filters button */}
      <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2 h-9 px-3"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('filters')}
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 min-w-5 p-0 justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle>{t('filters')}</SheetTitle>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground h-8"
                >
                  {t('clearFilters')}
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Genre toggles */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                {t('genres')}
              </label>
              {isLoadingGenres ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <ToggleGroup
                  type="multiple"
                  value={filters.genres.map(String)}
                  onValueChange={handleGenresChange}
                  className="flex flex-wrap gap-1.5 justify-start"
                  disabled={disabled}
                >
                  {allGenres.map((genre) => (
                    <ToggleGroupItem
                      key={genre.id}
                      value={String(genre.id)}
                      variant="outline"
                      size="sm"
                      className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {locale === 'ru' ? genre.nameRu : genre.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            </div>

            {/* Year range */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                {t('yearFrom')} — {t('yearTo')}
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1900}
                  max={2026}
                  placeholder="1900"
                  value={filters.yearFrom || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      yearFrom: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  disabled={disabled}
                  className="w-24"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="number"
                  min={1900}
                  max={2026}
                  placeholder="2026"
                  value={filters.yearTo || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      yearTo: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  disabled={disabled}
                  className="w-24"
                />
              </div>
            </div>

            {/* Rating slider */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                {t('minRating')}: <span className="text-primary">{filters.ratingMin || 0}</span>
              </label>
              <div className="px-1">
                <Slider
                  min={0}
                  max={9}
                  step={0.5}
                  value={[filters.ratingMin || 0]}
                  onValueChange={([value]) =>
                    onFiltersChange({
                      ...filters,
                      ratingMin: value || null,
                    })
                  }
                  disabled={disabled}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>0</span>
                  <span>5</span>
                  <span>9+</span>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
