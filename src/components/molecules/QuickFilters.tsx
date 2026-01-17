'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Small, XSmall } from '@/components/ui/typography';
import type { SearchFilters, MediaTypeFilter, OriginalLanguage } from '@/types/movie';
import { DEFAULT_LANGUAGES } from '@/types/movie';

interface Genre {
  id: number;
  name: string;
  nameRu: string;
  type: 'movie' | 'tv';
}

interface GenresResponse {
  movie: Genre[];
  tv: Genre[];
}

// Languages to show in quick filter
const QUICK_FILTER_LANGUAGES: { code: OriginalLanguage; labelEn: string; labelRu: string }[] = [
  { code: 'en', labelEn: 'English', labelRu: 'Английский' },
  { code: 'ru', labelEn: 'Russian', labelRu: 'Русский' },
  { code: 'ko', labelEn: 'Korean', labelRu: 'Корейский' },
  { code: 'ja', labelEn: 'Japanese', labelRu: 'Японский' },
  { code: 'tr', labelEn: 'Turkish', labelRu: 'Турецкий' },
];

// Check if languages array equals default
const isDefaultLanguages = (langs: OriginalLanguage[]): boolean => {
  if (langs.length !== DEFAULT_LANGUAGES.length) return false;
  const sortedLangs = [...langs].sort();
  const sortedDefault = [...DEFAULT_LANGUAGES].sort();
  return sortedLangs.every((lang, i) => lang === sortedDefault[i]);
};

// Capitalize first letter
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

interface QuickFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  locale: string;
  disabled?: boolean;
}

export function QuickFilters({
  filters,
  onFiltersChange,
  locale,
  disabled = false,
}: QuickFiltersProps) {
  const t = useTranslations('search');

  // Sheet states
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [genresSheetOpen, setGenresSheetOpen] = useState(false);
  const [ratingSheetOpen, setRatingSheetOpen] = useState(false);

  // Genres data
  const [genresData, setGenresData] = useState<GenresResponse>({ movie: [], tv: [] });

  // Local state for sheets (apply only on button click)
  const [localMediaType, setLocalMediaType] = useState<MediaTypeFilter>(filters.mediaType);
  const [localRating, setLocalRating] = useState<number>(filters.ratingMin || 0);
  const [localGenres, setLocalGenres] = useState<number[]>(filters.genres);
  const [localLanguages, setLocalLanguages] = useState<OriginalLanguage[]>(filters.originalLanguages);

  // Handlers to sync local state when sheets open
  const handleTypeSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setLocalMediaType(filters.mediaType);
    }
    setTypeSheetOpen(open);
  }, [filters.mediaType]);

  const handleRatingSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setLocalRating(filters.ratingMin || 0);
    }
    setRatingSheetOpen(open);
  }, [filters.ratingMin]);

  const handleGenresSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setLocalGenres(filters.genres);
    }
    setGenresSheetOpen(open);
  }, [filters.genres]);

  const handleLanguageSheetOpenChange = useCallback((open: boolean) => {
    if (open) {
      setLocalLanguages(filters.originalLanguages);
    }
    setLanguageSheetOpen(open);
  }, [filters.originalLanguages]);

  // Fetch genres on mount
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/genres');
        const data = await response.json();
        setGenresData(data);
      } catch (error) {
        console.error('Failed to fetch genres:', error);
      }
    };
    fetchGenres();
  }, []);

  // Get genres for movies and TV separately
  const movieGenres = useMemo(() => {
    return (genresData.movie || []).sort((a, b) => {
      const nameA = locale === 'ru' ? a.nameRu : a.name;
      const nameB = locale === 'ru' ? b.nameRu : b.name;
      return nameA.localeCompare(nameB);
    });
  }, [genresData.movie, locale]);

  const tvGenres = useMemo(() => {
    return (genresData.tv || []).sort((a, b) => {
      const nameA = locale === 'ru' ? a.nameRu : a.name;
      const nameB = locale === 'ru' ? b.nameRu : b.name;
      return nameA.localeCompare(nameB);
    });
  }, [genresData.tv, locale]);

  // Determine which genre sections to show based on mediaType
  const showMovieGenres = filters.mediaType === 'all' || filters.mediaType === 'movie';
  const showTvGenres = filters.mediaType === 'all' || filters.mediaType === 'tv';

  // Check if filters are active
  const isTypeActive = filters.mediaType !== 'all';
  const isLanguageActive = !isDefaultLanguages(filters.originalLanguages);
  const isGenresActive = filters.genres.length > 0;
  const isRatingActive = filters.ratingMin !== null && filters.ratingMin > 0;

  // Get label for active type
  const getTypeLabel = () => {
    if (filters.mediaType === 'movie') return locale === 'ru' ? 'Фильмы' : 'Movies';
    if (filters.mediaType === 'tv') return locale === 'ru' ? 'Сериалы' : 'TV Shows';
    return locale === 'ru' ? 'Тип' : 'Type';
  };

  // Get label for active languages (count without parentheses)
  const getLanguageLabel = () => {
    if (isLanguageActive) {
      const count = filters.originalLanguages.length;
      return locale === 'ru' ? `Язык ${count}` : `Language ${count}`;
    }
    return locale === 'ru' ? 'Язык' : 'Language';
  };

  // Get label for active genres (count without parentheses)
  const getGenresLabel = () => {
    if (isGenresActive) {
      const count = filters.genres.length;
      return locale === 'ru' ? `Жанры ${count}` : `Genres ${count}`;
    }
    return locale === 'ru' ? 'Жанры' : 'Genres';
  };

  // Get label for active rating
  const getRatingLabel = () => {
    if (isRatingActive) {
      return `${filters.ratingMin}+`;
    }
    return locale === 'ru' ? 'Рейтинг' : 'Rating';
  };

  // Get valid genre IDs for current mediaType
  const getValidGenreIds = useCallback((genreIds: number[], mediaType: MediaTypeFilter) => {
    if (mediaType === 'all') {
      const allIds = new Set([...movieGenres.map(g => g.id), ...tvGenres.map(g => g.id)]);
      return genreIds.filter(id => allIds.has(id));
    }
    if (mediaType === 'movie') {
      const movieIds = new Set(movieGenres.map(g => g.id));
      return genreIds.filter(id => movieIds.has(id));
    }
    if (mediaType === 'tv') {
      const tvIds = new Set(tvGenres.map(g => g.id));
      return genreIds.filter(id => tvIds.has(id));
    }
    return genreIds;
  }, [movieGenres, tvGenres]);

  // Local change handlers (update local state only)
  const handleLocalMediaTypeChange = useCallback(
    (value: string) => {
      if (!value) return;
      setLocalMediaType(value as MediaTypeFilter);
    },
    []
  );

  // Apply handler for media type
  const handleMediaTypeApply = useCallback(() => {
    // Filter out genres that don't exist in the new mediaType
    const validGenres = getValidGenreIds(filters.genres, localMediaType);
    onFiltersChange({
      ...filters,
      mediaType: localMediaType,
      genres: validGenres,
    });
    setTypeSheetOpen(false);
  }, [filters, onFiltersChange, localMediaType, getValidGenreIds]);

  // Local change handlers (update local state only)
  const handleLocalLanguagesChange = useCallback(
    (values: string[]) => {
      setLocalLanguages(values as OriginalLanguage[]);
    },
    []
  );

  const handleLocalGenresChange = useCallback(
    (values: string[]) => {
      const genreIds = values.map(Number).filter((n) => !isNaN(n));
      setLocalGenres(genreIds);
    },
    []
  );

  // Apply handlers (commit to parent)
  const handleLanguagesApply = useCallback(() => {
    onFiltersChange({ ...filters, originalLanguages: localLanguages });
    setLanguageSheetOpen(false);
  }, [filters, onFiltersChange, localLanguages]);

  const handleGenresApply = useCallback(() => {
    // Collect genre names (EN + RU) for filtering old-format data
    const allGenres = [...movieGenres, ...tvGenres];
    const genreNames: string[] = [];
    for (const id of localGenres) {
      const genre = allGenres.find(g => g.id === id);
      if (genre) {
        genreNames.push(genre.name.toLowerCase());
        if (genre.nameRu && genre.nameRu.toLowerCase() !== genre.name.toLowerCase()) {
          genreNames.push(genre.nameRu.toLowerCase());
        }
      }
    }
    onFiltersChange({ ...filters, genres: localGenres, genreNames });
    setGenresSheetOpen(false);
  }, [filters, onFiltersChange, localGenres, movieGenres, tvGenres]);

  const handleRatingApply = useCallback(() => {
    onFiltersChange({ ...filters, ratingMin: localRating || null });
    setRatingSheetOpen(false);
  }, [filters, onFiltersChange, localRating]);

  // Reset handlers
  const resetType = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({ ...filters, mediaType: 'all' });
  };

  const resetLanguage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({ ...filters, originalLanguages: DEFAULT_LANGUAGES });
  };

  const resetGenres = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({ ...filters, genres: [], genreNames: [] });
  };

  const resetRating = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFiltersChange({ ...filters, ratingMin: null });
  };

  return (
    <>
      {/* Type Button */}
      <QuickFilterButton
        label={getTypeLabel()}
        isActive={isTypeActive}
        onReset={resetType}
        onClick={() => setTypeSheetOpen(true)}
        disabled={disabled}
      />

      {/* Language Button */}
      <QuickFilterButton
        label={getLanguageLabel()}
        isActive={isLanguageActive}
        onReset={resetLanguage}
        onClick={() => setLanguageSheetOpen(true)}
        disabled={disabled}
      />

      {/* Genres Button */}
      <QuickFilterButton
        label={getGenresLabel()}
        isActive={isGenresActive}
        onReset={resetGenres}
        onClick={() => setGenresSheetOpen(true)}
        disabled={disabled}
      />

      {/* Rating Button */}
      <QuickFilterButton
        label={getRatingLabel()}
        isActive={isRatingActive}
        onReset={resetRating}
        onClick={() => setRatingSheetOpen(true)}
        disabled={disabled}
      />

      {/* Type Sheet */}
      <Sheet open={typeSheetOpen} onOpenChange={handleTypeSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-4">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{t('mediaType')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <ToggleGroup
              type="single"
              value={localMediaType}
              onValueChange={handleLocalMediaTypeChange}
              className="flex flex-wrap gap-1.5 justify-start"
            >
              <ToggleGroupItem
                value="all"
                variant="outline"
                size="sm"
                className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {t('mediaTypeAll')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="movie"
                variant="outline"
                size="sm"
                className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {t('mediaTypeMovie')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="tv"
                variant="outline"
                size="sm"
                className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {t('mediaTypeTv')}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant={localMediaType !== 'all' ? 'default' : 'secondary'}
              className="w-full h-12"
              onClick={handleMediaTypeApply}
            >
              {localMediaType !== 'all' ? t('apply') : t('close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Language Sheet */}
      <Sheet open={languageSheetOpen} onOpenChange={handleLanguageSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-4">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{t('originalLanguage')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <ToggleGroup
              type="multiple"
              value={localLanguages}
              onValueChange={handleLocalLanguagesChange}
              className="flex flex-wrap gap-1.5 justify-start"
            >
              {QUICK_FILTER_LANGUAGES.map((lang) => (
                <ToggleGroupItem
                  key={lang.code}
                  value={lang.code}
                  variant="outline"
                  size="sm"
                  className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {locale === 'ru' ? lang.labelRu : lang.labelEn}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              variant={localLanguages.length > 0 && !isDefaultLanguages(localLanguages) ? 'default' : 'secondary'}
              className="w-full h-12"
              onClick={handleLanguagesApply}
            >
              {localLanguages.length > 0 && !isDefaultLanguages(localLanguages) ? t('apply') : t('close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Genres Sheet */}
      <Sheet open={genresSheetOpen} onOpenChange={handleGenresSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-4 max-h-[70vh]">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{locale === 'ru' ? 'Жанры' : 'Genres'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="overflow-y-auto max-h-[calc(70vh-160px)] space-y-4">
              {/* Movie genres */}
              {showMovieGenres && (
                <div>
                  <Small className="mb-2 block text-muted-foreground">
                    {t('genresMovies')}
                  </Small>
                  <ToggleGroup
                    type="multiple"
                    value={localGenres.map(String)}
                    onValueChange={handleLocalGenresChange}
                    className="flex flex-wrap gap-1.5 justify-start"
                  >
                    {movieGenres.map((genre) => (
                      <ToggleGroupItem
                        key={`movie-${genre.id}`}
                        value={String(genre.id)}
                        variant="outline"
                        size="sm"
                        className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        {capitalize(locale === 'ru' ? genre.nameRu : genre.name)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}

              {/* TV genres */}
              {showTvGenres && (
                <div>
                  <Small className="mb-2 block text-muted-foreground">
                    {t('genresTv')}
                  </Small>
                  <ToggleGroup
                    type="multiple"
                    value={localGenres.map(String)}
                    onValueChange={handleLocalGenresChange}
                    className="flex flex-wrap gap-1.5 justify-start"
                  >
                    {tvGenres.map((genre) => (
                      <ToggleGroupItem
                        key={`tv-${genre.id}`}
                        value={String(genre.id)}
                        variant="outline"
                        size="sm"
                        className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        {capitalize(locale === 'ru' ? genre.nameRu : genre.name)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}
            </div>
            <Button
              variant={localGenres.length > 0 ? 'default' : 'secondary'}
              className="w-full h-12"
              onClick={handleGenresApply}
            >
              {localGenres.length > 0 ? t('apply') : t('close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rating Sheet */}
      <Sheet open={ratingSheetOpen} onOpenChange={handleRatingSheetOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-4">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{t('rating')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <Small className="mb-3 block">
                {t('minRating')}: <span className="text-primary">{localRating}</span>
              </Small>
              <div className="px-1">
                <Slider
                  min={0}
                  max={9}
                  step={0.5}
                  value={[localRating]}
                  onValueChange={([value]) => setLocalRating(value)}
                  className="w-full"
                />
                <div className="flex justify-between mt-2">
                  <XSmall className="text-muted-foreground">0</XSmall>
                  <XSmall className="text-muted-foreground">5</XSmall>
                  <XSmall className="text-muted-foreground">9+</XSmall>
                </div>
              </div>
            </div>
            <Button
              variant={localRating > 0 ? 'default' : 'secondary'}
              className="w-full h-12"
              onClick={handleRatingApply}
            >
              {localRating > 0 ? t('apply') : t('close')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Quick filter button component
interface QuickFilterButtonProps {
  label: string;
  isActive: boolean;
  onReset: (e: React.MouseEvent) => void;
  onClick: () => void;
  disabled?: boolean;
}

function QuickFilterButton({
  label,
  isActive,
  onReset,
  onClick,
  disabled = false,
}: QuickFilterButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-3 flex-shrink-0 gap-1.5 ${
        isActive
          ? 'bg-pink-500 border-pink-500 text-white hover:bg-pink-600 hover:border-pink-600 hover:text-white'
          : ''
      }`}
    >
      <span>{label}</span>
      {isActive && (
        <span
          role="button"
          tabIndex={0}
          onClick={onReset}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onReset(e as unknown as React.MouseEvent);
            }
          }}
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-pink-600 cursor-pointer"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
        </span>
      )}
    </Button>
  );
}
