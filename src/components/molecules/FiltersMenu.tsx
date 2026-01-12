'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { PreferenceHorizontalIcon } from '@hugeicons/core-free-icons';
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
import { Small, XSmall, Muted } from '@/components/ui/typography';
import type { SearchFilters, MediaTypeFilter } from '@/types/movie';

interface Genre {
  id: number;
  name: string;
  nameRu: string;
}

interface FiltersMenuProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  locale: string;
  disabled?: boolean;
}

export function FiltersMenu({
  filters,
  onFiltersChange,
  locale,
  disabled = false,
}: FiltersMenuProps) {
  const t = useTranslations('search');
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  const clearFilters = useCallback(() => {
    onFiltersChange({
      genres: [],
      yearFrom: null,
      yearTo: null,
      ratingMin: null,
      sortBy: filters.sortBy,
      mediaType: filters.mediaType,
    });
  }, [filters.sortBy, filters.mediaType, onFiltersChange]);

  const activeFiltersCount =
    filters.genres.length +
    (filters.yearFrom ? 1 : 0) +
    (filters.yearTo ? 1 : 0) +
    (filters.ratingMin ? 1 : 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 h-9 px-3"
        >
          <HugeiconsIcon icon={PreferenceHorizontalIcon} size={16} />
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
          {/* Media type filter */}
          <div>
            <Small className="mb-3 block">
              {t('mediaType')}
            </Small>
            <ToggleGroup
              type="single"
              value={filters.mediaType}
              onValueChange={(value) => {
                if (value) {
                  onFiltersChange({ ...filters, mediaType: value as MediaTypeFilter });
                }
              }}
              className="justify-start"
              disabled={disabled}
            >
              <ToggleGroupItem value="all" className="px-4">
                {t('mediaTypeAll')}
              </ToggleGroupItem>
              <ToggleGroupItem value="movie" className="px-4">
                {t('mediaTypeMovie')}
              </ToggleGroupItem>
              <ToggleGroupItem value="tv" className="px-4">
                {t('mediaTypeTv')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Genre toggles */}
          <div>
            <Small className="mb-3 block">
              {t('genres')}
            </Small>
            {isLoadingGenres ? (
              <Muted>Loading...</Muted>
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
            <Small className="mb-3 block">
              {t('yearFrom')} — {t('yearTo')}
            </Small>
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
            <Small className="mb-3 block">
              {t('minRating')}: <span className="text-primary">{filters.ratingMin || 0}</span>
            </Small>
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
              <div className="flex justify-between mt-2">
                <XSmall className="text-muted-foreground">0</XSmall>
                <XSmall className="text-muted-foreground">5</XSmall>
                <XSmall className="text-muted-foreground">9+</XSmall>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
