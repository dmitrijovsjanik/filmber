'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { FilterIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Small, XSmall, Muted } from '@/components/ui/typography';
import { useGenresList } from '@/hooks/useGenresList';
import type { SearchFilters, MediaTypeFilter, OriginalLanguage } from '@/types/movie';
import { DEFAULT_LANGUAGES } from '@/types/movie';

// Popular genre IDs (TMDB)
const POPULAR_MOVIE_GENRE_IDS = [28, 35, 18, 27, 878]; // Action, Comedy, Drama, Horror, Sci-Fi
const POPULAR_TV_GENRE_IDS = [18, 35, 10759, 80, 10765]; // Drama, Comedy, Action & Adventure, Crime, Sci-Fi & Fantasy

// TV genres to hide from filters (Talk Shows, Reality TV)
const HIDDEN_TV_GENRE_IDS = [10767, 10764]; // Talk, Reality

// Default languages shown (EN, RU, KO, JA, TR)
const DEFAULT_VISIBLE_LANGUAGES: OriginalLanguage[] = ['en', 'ru', 'ko', 'ja', 'tr'];

// All available languages
const LANGUAGES: { code: OriginalLanguage; labelEn: string; labelRu: string }[] = [
  { code: 'en', labelEn: 'English', labelRu: 'Английский' },
  { code: 'ru', labelEn: 'Russian', labelRu: 'Русский' },
  { code: 'ko', labelEn: 'Korean', labelRu: 'Корейский' },
  { code: 'ja', labelEn: 'Japanese', labelRu: 'Японский' },
  { code: 'fr', labelEn: 'French', labelRu: 'Французский' },
  { code: 'de', labelEn: 'German', labelRu: 'Немецкий' },
  { code: 'es', labelEn: 'Spanish', labelRu: 'Испанский' },
  { code: 'it', labelEn: 'Italian', labelRu: 'Итальянский' },
  { code: 'zh', labelEn: 'Chinese', labelRu: 'Китайский' },
  { code: 'hi', labelEn: 'Hindi', labelRu: 'Хинди' },
  { code: 'tr', labelEn: 'Turkish', labelRu: 'Турецкий' },
];

// Helper to capitalize first letter
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Check if languages array equals default
const isDefaultLanguages = (langs: OriginalLanguage[]): boolean => {
  if (langs.length !== DEFAULT_LANGUAGES.length) return false;
  const sortedLangs = [...langs].sort();
  const sortedDefault = [...DEFAULT_LANGUAGES].sort();
  return sortedLangs.every((lang, i) => lang === sortedDefault[i]);
};

interface FiltersMenuProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  locale: string;
  disabled?: boolean;
}

export const FiltersMenu = memo(function FiltersMenu({
  filters,
  onFiltersChange,
  locale,
  disabled = false,
}: FiltersMenuProps) {
  const t = useTranslations('search');
  const { genresData, isLoading: isLoadingGenres } = useGenresList();
  const [isOpen, setIsOpen] = useState(false);

  // Animation state machine
  const [renderState, setRenderState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [mounted, setMounted] = useState(false);

  // State for showing all options
  const [showAllMovieGenres, setShowAllMovieGenres] = useState(false);
  const [showAllTvGenres, setShowAllTvGenres] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  // Handle mount for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle opening
  useEffect(() => {
    if (isOpen && (renderState === 'hidden' || renderState === 'exiting')) {
      setRenderState('entering');
    }
  }, [isOpen, renderState]);

  // Handle entering animation
  useEffect(() => {
    if (renderState === 'entering') {
      const frameId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderState('visible');
        });
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [renderState]);

  // Handle closing - use double rAF to ensure browser has painted current state
  useEffect(() => {
    if (!isOpen && (renderState === 'visible' || renderState === 'entering')) {
      const frameId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderState('exiting');
        });
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [isOpen, renderState]);

  // Handle exiting animation
  useEffect(() => {
    if (renderState === 'exiting') {
      const timer = setTimeout(() => {
        setRenderState('hidden');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [renderState]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (renderState !== 'hidden') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [renderState]);

  const movieGenres = useMemo(() => genresData.movie || [], [genresData.movie]);
  const tvGenres = useMemo(() => genresData.tv || [], [genresData.tv]);

  // Split genres into popular and other
  const { popularMovieGenres, otherMovieGenres } = useMemo(() => {
    const popular = movieGenres.filter((g) => POPULAR_MOVIE_GENRE_IDS.includes(g.id));
    const other = movieGenres.filter((g) => !POPULAR_MOVIE_GENRE_IDS.includes(g.id));
    // Sort popular by the order in POPULAR_MOVIE_GENRE_IDS
    popular.sort((a, b) =>
      POPULAR_MOVIE_GENRE_IDS.indexOf(a.id) - POPULAR_MOVIE_GENRE_IDS.indexOf(b.id)
    );
    return { popularMovieGenres: popular, otherMovieGenres: other };
  }, [movieGenres]);

  const { popularTvGenres, otherTvGenres } = useMemo(() => {
    // Filter out hidden genres (Talk Shows, Reality TV)
    const filteredTvGenres = tvGenres.filter((g) => !HIDDEN_TV_GENRE_IDS.includes(g.id));
    const popular = filteredTvGenres.filter((g) => POPULAR_TV_GENRE_IDS.includes(g.id));
    const other = filteredTvGenres.filter((g) => !POPULAR_TV_GENRE_IDS.includes(g.id));
    // Sort popular by the order in POPULAR_TV_GENRE_IDS
    popular.sort((a, b) =>
      POPULAR_TV_GENRE_IDS.indexOf(a.id) - POPULAR_TV_GENRE_IDS.indexOf(b.id)
    );
    return { popularTvGenres: popular, otherTvGenres: other };
  }, [tvGenres]);

  // Split languages into default visible and other
  const { visibleLanguages, otherLanguages } = useMemo(() => {
    const visible = LANGUAGES.filter((l) => DEFAULT_VISIBLE_LANGUAGES.includes(l.code));
    const other = LANGUAGES.filter((l) => !DEFAULT_VISIBLE_LANGUAGES.includes(l.code));
    return { visibleLanguages: visible, otherLanguages: other };
  }, []);

  // Get valid genre IDs for current mediaType to filter out invalid selections
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

  const handleGenresChange = useCallback(
    (values: string[]) => {
      // Filter out special "more" buttons
      const filtered = values.filter((v) => !v.startsWith('_more_'));
      const genreIds = filtered.map(Number).filter((n) => !isNaN(n));
      // Collect genre names (EN + RU) for filtering old-format data
      const allGenres = [...movieGenres, ...tvGenres];
      const genreNames: string[] = [];
      for (const id of genreIds) {
        const genre = allGenres.find(g => g.id === id);
        if (genre) {
          genreNames.push(genre.name.toLowerCase());
          if (genre.nameRu && genre.nameRu.toLowerCase() !== genre.name.toLowerCase()) {
            genreNames.push(genre.nameRu.toLowerCase());
          }
        }
      }
      onFiltersChange({ ...filters, genres: genreIds, genreNames });
    },
    [filters, onFiltersChange, movieGenres, tvGenres]
  );

  const handleMediaTypeChange = useCallback(
    (value: string) => {
      if (!value) return;
      const newMediaType = value as MediaTypeFilter;
      // Filter out genres that don't exist in the new mediaType
      const validGenres = getValidGenreIds(filters.genres, newMediaType);
      onFiltersChange({
        ...filters,
        mediaType: newMediaType,
        genres: validGenres,
      });
    },
    [filters, onFiltersChange, getValidGenreIds]
  );

  const handleLanguagesChange = useCallback(
    (values: string[]) => {
      // Filter out special "more" button
      const filtered = values.filter((v) => !v.startsWith('_more_'));
      const langs = filtered as OriginalLanguage[];
      onFiltersChange({
        ...filters,
        originalLanguages: langs,
      });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({
      genres: [],
      genreNames: [],
      yearFrom: null,
      yearTo: null,
      ratingMin: null,
      sortBy: filters.sortBy,
      mediaType: filters.mediaType,
      originalLanguages: DEFAULT_LANGUAGES,
      runtimeMin: null,
      runtimeMax: null,
    });
    // Reset "show all" states
    setShowAllMovieGenres(false);
    setShowAllTvGenres(false);
    setShowAllLanguages(false);
  }, [filters.sortBy, filters.mediaType, onFiltersChange]);

  // Calculate active filters count (don't count default languages)
  const activeFiltersCount =
    filters.genres.length +
    (filters.yearFrom ? 1 : 0) +
    (filters.yearTo ? 1 : 0) +
    (filters.ratingMin ? 1 : 0) +
    (!isDefaultLanguages(filters.originalLanguages) ? 1 : 0) +
    (filters.runtimeMin ? 1 : 0) +
    (filters.runtimeMax ? 1 : 0);

  const showMovieGenres = filters.mediaType === 'all' || filters.mediaType === 'movie';
  const showTvGenres = filters.mediaType === 'all' || filters.mediaType === 'tv';
  const showRuntimeFilter = filters.mediaType !== 'tv';

  // Determine which genres to show
  const visibleMovieGenres = showAllMovieGenres
    ? [...popularMovieGenres, ...otherMovieGenres]
    : popularMovieGenres;
  const visibleTvGenres = showAllTvGenres
    ? [...popularTvGenres, ...otherTvGenres]
    : popularTvGenres;
  const displayedLanguages = showAllLanguages
    ? LANGUAGES
    : visibleLanguages;

  // Determine animation state
  const isAnimatedOpen = renderState === 'visible';
  const overlayOpacity = isAnimatedOpen ? 'opacity-100' : 'opacity-0';
  const contentTransform = isAnimatedOpen ? 'translateX(0)' : 'translateX(100%)';

  const modalContent = mounted && renderState !== 'hidden' ? createPortal(
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-500 ${overlayOpacity}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full bg-background flex flex-col shadow-lg transition-transform duration-500 will-change-transform"
        style={{
          transform: contentTransform,
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
            {/* Header - with Telegram safe area for fullscreen mode */}
            <div className="flex items-center justify-between px-2 py-4 border-b tg-safe-area-top">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-10 w-10 rounded-full"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
                </Button>
                <h2 className="text-lg font-semibold">{t('filters')}</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className={`h-8 ${activeFiltersCount > 0 ? 'text-muted-foreground' : 'invisible'}`}
              >
                {t('clearFilters')}
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="space-y-6 max-w-lg mx-auto">
                {/* Media type filter */}
                <div>
                  <Small className="mb-3 block">
                    {t('mediaType')}
                  </Small>
                  <ToggleGroup
                    type="single"
                    value={filters.mediaType}
                    onValueChange={handleMediaTypeChange}
                    className="flex flex-wrap gap-1.5 justify-start"
                    disabled={disabled}
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
                </div>

                {/* Original language filter (multi-select) */}
                <div>
                  <Small className="mb-3 block">
                    {t('originalLanguage')}
                  </Small>
                  <ToggleGroup
                    type="multiple"
                    value={filters.originalLanguages}
                    onValueChange={handleLanguagesChange}
                    className="flex flex-wrap gap-1.5 justify-start"
                    disabled={disabled}
                  >
                    {displayedLanguages.map((lang) => (
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
                    {!showAllLanguages && otherLanguages.length > 0 && (
                      <ToggleGroupItem
                        value="_more_languages"
                        size="sm"
                        className="px-3"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAllLanguages(true);
                        }}
                      >
                        {locale === 'ru' ? 'Ещё' : 'More'}
                      </ToggleGroupItem>
                    )}
                  </ToggleGroup>
                </div>

                {/* Movie genres */}
                {showMovieGenres && (
                  <div>
                    <Small className="mb-3 block">
                      {t('genresMovies')}
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
                        {visibleMovieGenres.map((genre) => (
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
                        {!showAllMovieGenres && otherMovieGenres.length > 0 && (
                          <ToggleGroupItem
                            value="_more_movie_genres"
                            size="sm"
                            className="px-3"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAllMovieGenres(true);
                            }}
                          >
                            {locale === 'ru' ? 'Ещё' : 'More'}
                          </ToggleGroupItem>
                        )}
                      </ToggleGroup>
                    )}
                  </div>
                )}

                {/* TV genres */}
                {showTvGenres && (
                  <div>
                    <Small className="mb-3 block">
                      {t('genresTv')}
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
                        {visibleTvGenres.map((genre) => (
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
                        {!showAllTvGenres && otherTvGenres.length > 0 && (
                          <ToggleGroupItem
                            value="_more_tv_genres"
                            size="sm"
                            className="px-3"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAllTvGenres(true);
                            }}
                          >
                            {locale === 'ru' ? 'Ещё' : 'More'}
                          </ToggleGroupItem>
                        )}
                      </ToggleGroup>
                    )}
                  </div>
                )}

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

                {/* Runtime filter (movies only) */}
                {showRuntimeFilter && (
                  <div>
                    <Small className="mb-3 block">
                      {t('runtime')}
                    </Small>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        max={600}
                        placeholder="60"
                        value={filters.runtimeMin || ''}
                        onChange={(e) =>
                          onFiltersChange({
                            ...filters,
                            runtimeMin: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        disabled={disabled}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Input
                        type="number"
                        min={0}
                        max={600}
                        placeholder="180"
                        value={filters.runtimeMax || ''}
                        onChange={(e) =>
                          onFiltersChange({
                            ...filters,
                            runtimeMax: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        disabled={disabled}
                        className="w-24"
                      />
                    </div>
                  </div>
                )}

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
            </div>

            {/* Footer with Apply/Close button - with Telegram safe area for fullscreen mode */}
            <div className="border-t px-4 py-3 tg-safe-area-bottom">
              <div className="max-w-lg mx-auto">
                <Button
                  variant={activeFiltersCount > 0 ? 'default' : 'secondary'}
                  className="w-full h-12"
                  onClick={() => setIsOpen(false)}
                >
                  {activeFiltersCount > 0 ? t('apply') : t('close')}
                </Button>
              </div>
            </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`h-9 w-9 flex-shrink-0 ${
          activeFiltersCount > 0
            ? 'bg-pink-500 border-pink-500 hover:bg-pink-600 hover:border-pink-600'
            : ''
        }`}
      >
        <HugeiconsIcon
          icon={FilterIcon}
          size={18}
          className={activeFiltersCount > 0 ? 'text-white' : ''}
        />
      </Button>
      {modalContent}
    </>
  );
});
