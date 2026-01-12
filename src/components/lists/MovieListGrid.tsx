'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { MovieListItem } from './MovieListItem';
import { ListFilter } from './ListFilter';
import { SearchServiceTabs, type SearchService } from './SearchServiceTabs';
import { SearchResultItem } from './SearchResultItem';
import { SearchFilters } from './SearchFilters';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { ScrollFadeContainer } from '@/components/ui/ScrollFadeContainer';
import { useAuthToken } from '@/stores/authStore';
import { useListStore, type ListItem } from '@/stores/listStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAnalytics } from '@/hooks/useAnalytics';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import { useClearSearchTrigger } from '@/stores/searchStore';
import type { SearchResult, SearchFilters as SearchFiltersType } from '@/types/movie';

interface SourceStatus {
  tmdb: boolean;
  omdb: boolean;
  kinopoisk: boolean;
}

interface FilterCounts {
  all: number;
  wantToWatch: number;
  watched: number;
  ratings: Record<number, number>;
}

interface MovieListGridProps {
  initialStatus?: MovieStatus | 'all';
}

export function MovieListGrid({ initialStatus = 'all' }: MovieListGridProps) {
  const t = useTranslations('lists');
  const locale = useLocale();
  const token = useAuthToken();
  const clearSearchTrigger = useClearSearchTrigger();
  const { trackMovieRemoved, trackListSearchUsed } = useAnalytics();

  // Use listStore for caching
  const {
    cache,
    hasHydrated,
    setCache,
    updateItem,
    removeItem: removeItemFromCache,
    isCacheValid,
    isCacheStale,
    setFetching,
  } = useListStore();

  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoadingLocal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<MovieStatus | 'all'>(initialStatus);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 400);

  // Clear search when triggered from nav
  useEffect(() => {
    if (clearSearchTrigger > 0) {
      setSearchQuery('');
    }
  }, [clearSearchTrigger]);

  // Counts for list filters
  const [listCounts, setListCounts] = useState<FilterCounts>({
    all: 0,
    wantToWatch: 0,
    watched: 0,
    ratings: { 1: 0, 2: 0, 3: 0 },
  });

  // External search state
  const [searchMode, setSearchMode] = useState<'local' | SearchService>('local');
  const [searchResults, setSearchResults] = useState<{
    tmdb: SearchResult[];
    omdb: SearchResult[];
    kinopoisk: SearchResult[];
    tmdbCount: number;
    omdbCount: number;
    kinopoiskCount: number;
    sourceStatus: SourceStatus;
  }>({
    tmdb: [],
    omdb: [],
    kinopoisk: [],
    tmdbCount: 0,
    omdbCount: 0,
    kinopoiskCount: 0,
    sourceStatus: { tmdb: true, omdb: true, kinopoisk: true },
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasTrackedSearch, setHasTrackedSearch] = useState(false);
  const hasShownTmdbWarning = useRef(false);

  // Pagination state for infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Expanded search state
  const [expandedResults, setExpandedResults] = useState<SearchResult[]>([]);
  const [isLoadingExpanded, setIsLoadingExpanded] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [showExpandedSection, setShowExpandedSection] = useState(false);

  // Search filters state
  const [searchFilters, setSearchFilters] = useState<SearchFiltersType>({
    genres: [],
    yearFrom: null,
    yearTo: null,
    ratingMin: null,
    sortBy: 'relevance',
  });

  // Apply filters and sorting to local items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by status (from ListFilter tabs)
    // Note: "watching" status movies are shown in all tabs (active timer)
    if (statusFilter !== 'all') {
      result = result.filter((item) =>
        item.status === statusFilter || item.status === MOVIE_STATUS.WATCHING
      );
    }

    // Filter by rating (from ListFilter tabs, only for watched)
    if (ratingFilter !== null) {
      result = result.filter((item) => item.rating === ratingFilter);
    }

    // Filter by genres
    if (searchFilters.genres.length > 0) {
      result = result.filter((item) => {
        if (!item.movie?.genres) return false;
        try {
          const movieGenres: { id: number }[] = JSON.parse(item.movie.genres);
          return searchFilters.genres.some((gId) =>
            movieGenres.some((g) => g.id === gId)
          );
        } catch {
          return false;
        }
      });
    }

    // Filter by year range
    if (searchFilters.yearFrom) {
      result = result.filter((item) => {
        if (!item.movie?.releaseDate) return false;
        const year = parseInt(item.movie.releaseDate.substring(0, 4));
        return year >= searchFilters.yearFrom!;
      });
    }

    if (searchFilters.yearTo) {
      result = result.filter((item) => {
        if (!item.movie?.releaseDate) return false;
        const year = parseInt(item.movie.releaseDate.substring(0, 4));
        return year <= searchFilters.yearTo!;
      });
    }

    // Filter by minimum rating
    if (searchFilters.ratingMin) {
      result = result.filter((item) => {
        if (!item.movie?.voteAverage) return false;
        const rating = parseFloat(item.movie.voteAverage);
        return rating >= searchFilters.ratingMin!;
      });
    }

    // Sort: watching movies always first, then apply selected sort
    result.sort((a, b) => {
      // Watching status takes priority
      const aIsWatching = a.status === MOVIE_STATUS.WATCHING ? 1 : 0;
      const bIsWatching = b.status === MOVIE_STATUS.WATCHING ? 1 : 0;
      if (aIsWatching !== bIsWatching) {
        return bIsWatching - aIsWatching;
      }

      // Then apply selected sort
      if (searchFilters.sortBy === 'relevance') {
        return 0;
      }

      switch (searchFilters.sortBy) {
        case 'popularity':
          // For local list, we don't have popularity data, so skip
          return 0;
        case 'rating': {
          const ratingA = parseFloat(a.movie?.voteAverage || '0');
          const ratingB = parseFloat(b.movie?.voteAverage || '0');
          return ratingB - ratingA;
        }
        case 'date_desc': {
          const dateA = a.movie?.releaseDate || '0000';
          const dateB = b.movie?.releaseDate || '0000';
          return dateB.localeCompare(dateA);
        }
        case 'date_asc': {
          const dateA = a.movie?.releaseDate || '9999';
          const dateB = b.movie?.releaseDate || '9999';
          return dateA.localeCompare(dateB);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [items, statusFilter, ratingFilter, searchFilters]);

  // Fetch user's list items from API
  const fetchFromApi = useCallback(async (isBackground = false) => {
    if (!token) return;

    if (!isBackground) {
      setIsLoadingLocal(true);
    }
    setError(null);

    try {
      // Always fetch full list for caching, filter locally
      const response = await fetch('/api/lists', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      const data = await response.json();

      // Update cache
      setCache(data.items, data.counts || {
        all: data.items.length,
        wantToWatch: 0,
        watched: 0,
        ratings: { 1: 0, 2: 0, 3: 0 },
      });

      setItems(data.items);
      if (data.counts) {
        setListCounts(data.counts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingLocal(false);
      setFetching(false);
    }
  }, [token, setCache, setFetching]);

  // Initialize from cache or fetch
  useEffect(() => {
    if (!hasHydrated || !token) return;
    if (searchMode !== 'local') return;

    // If we have valid cache, use it immediately
    if (cache && isCacheValid()) {
      setItems(cache.items);
      setListCounts(cache.counts);
      setIsLoadingLocal(false);

      // If cache is stale, refetch in background
      if (isCacheStale()) {
        setFetching(true);
        fetchFromApi(true);
      }
    } else {
      // No cache or invalid, fetch fresh data
      fetchFromApi(false);
    }
  }, [hasHydrated, token, searchMode]);

  // Refetch when filters change (but use cached data for display)
  const fetchItems = useCallback(async () => {
    // This is now mainly for refreshing counts after mutations
    // The actual filtering happens locally via filteredItems
    if (!token) return;
    await fetchFromApi(true);
  }, [token, fetchFromApi]);

  // Build search URL with filters
  const buildSearchUrl = useCallback(
    (query: string, page: number) => {
      const params = new URLSearchParams({
        query,
        page: String(page),
      });

      if (searchFilters.genres.length > 0) {
        params.set('genres', searchFilters.genres.join(','));
      }
      if (searchFilters.yearFrom) {
        params.set('yearFrom', String(searchFilters.yearFrom));
      }
      if (searchFilters.yearTo) {
        params.set('yearTo', String(searchFilters.yearTo));
      }
      if (searchFilters.ratingMin) {
        params.set('ratingMin', String(searchFilters.ratingMin));
      }
      if (searchFilters.sortBy !== 'relevance') {
        params.set('sortBy', searchFilters.sortBy);
      }

      return `/api/search?${params}`;
    },
    [searchFilters]
  );

  // External search effect
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults({
        tmdb: [],
        omdb: [],
        kinopoisk: [],
        tmdbCount: 0,
        omdbCount: 0,
        kinopoiskCount: 0,
        sourceStatus: { tmdb: true, omdb: true, kinopoisk: true },
      });
      setSearchMode('local');
      setCurrentPage(1);
      setTotalPages(0);
      setHasMore(false);
      // Reset expanded search
      setExpandedResults([]);
      setShowExpandedSection(false);
      setExpandedQuery(null);
      setHasTrackedSearch(false);
      hasShownTmdbWarning.current = false;
      return;
    }

    // Switch to external search mode
    if (searchMode === 'local') {
      setSearchMode('tmdb');
    }

    // Track search usage once per search session
    if (!hasTrackedSearch) {
      trackListSearchUsed();
      setHasTrackedSearch(true);
    }

    // Reset pagination and expanded search on new query
    setCurrentPage(1);
    setExpandedResults([]);
    setShowExpandedSection(false);
    setExpandedQuery(null);

    const searchExternalServices = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(buildSearchUrl(debouncedQuery, 1));
        const data = await response.json();

        const sourceStatus = data.sourceStatus || { tmdb: true, omdb: true, kinopoisk: true };

        setSearchResults({
          tmdb: data.tmdb?.results || [],
          omdb: data.omdb?.results || [],
          kinopoisk: data.kinopoisk?.results || [],
          tmdbCount: data.tmdb?.totalResults || 0,
          omdbCount: data.omdb?.totalResults || 0,
          kinopoiskCount: data.kinopoisk?.totalResults || 0,
          sourceStatus,
        });
        setTotalPages(data.tmdb?.totalPages || 0);
        setHasMore((data.tmdb?.page || 1) < (data.tmdb?.totalPages || 0));

        // Show toast warning if TMDB is unavailable
        if (!sourceStatus.tmdb && !hasShownTmdbWarning.current) {
          hasShownTmdbWarning.current = true;
          toast.warning(t('tmdbUnavailable', {
            defaultValue: 'TMDB unavailable, using alternative sources',
          }));
        }
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults({
          tmdb: [],
          omdb: [],
          kinopoisk: [],
          tmdbCount: 0,
          omdbCount: 0,
          kinopoiskCount: 0,
          sourceStatus: { tmdb: false, omdb: false, kinopoisk: false },
        });
        setHasMore(false);
      } finally {
        setIsSearching(false);
      }
    };

    searchExternalServices();
  }, [debouncedQuery, searchFilters, buildSearchUrl]);

  // Update item status - optimistic update
  const handleStatusChange = async (tmdbId: number, newStatus: MovieStatus) => {
    if (!token) return;

    // Optimistic update - update local state and cache immediately
    setItems((prev) =>
      prev.map((item) =>
        item.tmdbId === tmdbId ? { ...item, status: newStatus } : item
      )
    );
    updateItem(tmdbId, { status: newStatus });

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Revert on error - refetch to get correct state
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchItems(); // Revert on error
    }
  };

  // Update item rating - optimistic update
  const handleRatingChange = async (tmdbId: number, newRating: number) => {
    if (!token) return;

    const rating = newRating || null;

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.tmdbId === tmdbId ? { ...item, rating } : item
      )
    );
    updateItem(tmdbId, { rating });

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        fetchItems(); // Revert on error
      }
    } catch (err) {
      console.error('Failed to update rating:', err);
      fetchItems(); // Revert on error
    }
  };

  // Remove item - optimistic update
  const handleRemove = async (tmdbId: number) => {
    if (!token) return;

    // Optimistic update
    trackMovieRemoved(tmdbId);
    setItems((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    removeItemFromCache(tmdbId);

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        fetchItems(); // Revert on error
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  // Handle adding from search results
  const handleAddedFromSearch = () => {
    // Refetch items to update list and counts
    fetchItems();
  };

  // Load more results for infinite scroll
  const loadMoreResults = useCallback(async () => {
    if (isLoadingMore || !hasMore || !debouncedQuery) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const response = await fetch(buildSearchUrl(debouncedQuery, nextPage));
      const data = await response.json();

      // Append new results to existing
      setSearchResults((prev) => ({
        ...prev,
        tmdb: [...prev.tmdb, ...(data.tmdb?.results || [])],
        tmdbCount: data.tmdb?.totalResults || prev.tmdbCount,
      }));

      setCurrentPage(nextPage);
      setHasMore(nextPage < (data.tmdb?.totalPages || 0));
    } catch (err) {
      console.error('Failed to load more:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, debouncedQuery, currentPage, buildSearchUrl]);

  // Initialize infinite scroll hook
  const { lastElementRef } = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore,
    onLoadMore: loadMoreResults,
  });

  // Check if expanded search is available (query has 2+ words)
  const canExpandSearch = useCallback((query: string): boolean => {
    const words = query.trim().split(/\s+/);
    return words.length >= 2;
  }, []);

  // Get broader query (remove last word)
  const getBroaderQuery = useCallback((query: string): string => {
    const words = query.trim().split(/\s+/);
    return words.slice(0, -1).join(' ');
  }, []);

  // Handle "Show More" expanded search
  const handleExpandedSearch = useCallback(async () => {
    if (!debouncedQuery || !canExpandSearch(debouncedQuery)) return;

    setIsLoadingExpanded(true);
    const broaderQuery = getBroaderQuery(debouncedQuery);
    setExpandedQuery(broaderQuery);

    try {
      const response = await fetch(
        `/api/search?query=${encodeURIComponent(broaderQuery)}&page=1`
      );
      const data = await response.json();

      // Filter out results already in main results
      const existingIds = new Set(searchResults.tmdb.map((r) => r.tmdbId));
      const newResults = (data.tmdb?.results || []).filter(
        (r: SearchResult) => !existingIds.has(r.tmdbId)
      );

      setExpandedResults(newResults);
      setShowExpandedSection(true);
    } catch (err) {
      console.error('Expanded search failed:', err);
      setExpandedResults([]);
    } finally {
      setIsLoadingExpanded(false);
    }
  }, [debouncedQuery, canExpandSearch, getBroaderQuery, searchResults.tmdb]);

  // Handle watch complete (from timer prompt) - optimistic update
  const handleWatchComplete = async (tmdbId: number, rating: number) => {
    if (!token) return;

    // Optimistic update
    const updates = { status: 'watched' as MovieStatus, rating, watchStartedAt: null };
    setItems((prev) =>
      prev.map((item) =>
        item.tmdbId === tmdbId ? { ...item, ...updates } : item
      )
    );
    updateItem(tmdbId, updates);

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'watched',
          rating,
        }),
      });

      if (!response.ok) {
        fetchItems(); // Revert on error
      }
    } catch (err) {
      console.error('Failed to mark as watched:', err);
      fetchItems(); // Revert on error
    }
  };

  // Handle "not yet" (from timer prompt) - optimistic update
  const handleWatchNotYet = async (tmdbId: number) => {
    if (!token) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.tmdbId === tmdbId ? { ...item, watchStartedAt: null } : item
      )
    );
    updateItem(tmdbId, { watchStartedAt: null });

    try {
      // Clear watchStartedAt so prompt doesn't show again
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          watchStartedAt: null,
        }),
      });

      if (!response.ok) {
        fetchItems(); // Revert on error
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
      fetchItems(); // Revert on error
    }
  };

  // Get current search results based on selected service
  const currentSearchResults =
    searchMode === 'tmdb'
      ? searchResults.tmdb
      : searchMode === 'kinopoisk'
        ? searchResults.kinopoisk
        : searchResults.omdb;

  const isExternalSearch = searchMode === 'tmdb' || searchMode === 'omdb' || searchMode === 'kinopoisk';

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header: Search + Filters */}
      <div className="flex-shrink-0 space-y-2 pb-4 bg-background">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('searchPlaceholder', { defaultValue: 'Search movies...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="min-h-12 w-full rounded-xl border border-input bg-background px-4 py-3 pl-10 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:border-primary"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <HugeiconsIcon icon={Search01Icon} size={20} />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          )}
        </div>

        {/* Service tabs (when doing external search) */}
        {isExternalSearch && (
          <SearchServiceTabs
            activeService={searchMode as SearchService}
            tmdbCount={searchResults.tmdbCount}
            omdbCount={searchResults.omdbCount}
            kinopoiskCount={searchResults.kinopoiskCount}
            onServiceChange={(service) => setSearchMode(service)}
            isSearching={isSearching}
            sourceStatus={searchResults.sourceStatus}
          />
        )}

        {/* Status/Rating filters (when viewing local list) */}
        {!isExternalSearch && (
          <ListFilter
            status={statusFilter}
            rating={ratingFilter}
            onStatusChange={setStatusFilter}
            onRatingChange={setRatingFilter}
            counts={listCounts}
          />
        )}

        {/* Search filters */}
        <SearchFilters
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          locale={locale}
          disabled={isSearching}
        />
      </div>

      {/* Scrollable content */}
      <ScrollFadeContainer innerClassName="pb-2">
      {isExternalSearch ? (
        // External search results
        isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
          </div>
        ) : currentSearchResults.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mb-4 text-4xl">🔍</div>
            <p className="text-muted-foreground">
              {t('noSearchResults', { defaultValue: 'No movies found' })}
            </p>
          </div>
        ) : (
          <>
            <motion.div layout className="space-y-3">
              <AnimatePresence>
                {currentSearchResults.map((result, index) => (
                  <SearchResultItem
                    key={`${result.source}-${result.tmdbId || result.imdbId}-${index}`}
                    ref={index === currentSearchResults.length - 1 ? lastElementRef : null}
                    {...result}
                    onAddedToList={handleAddedFromSearch}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader size="md" />
              </div>
            )}

            {/* Show More button - appears when at end of results */}
            {!isSearching &&
              !hasMore &&
              currentSearchResults.length > 0 &&
              canExpandSearch(debouncedQuery) &&
              !showExpandedSection && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-6"
                >
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('endOfResults', { defaultValue: "That's all for this search" })}
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleExpandedSearch}
                    disabled={isLoadingExpanded}
                  >
                    {isLoadingExpanded ? (
                      <Loader size="sm" />
                    ) : (
                      t('showMore', { defaultValue: 'Show more results' })
                    )}
                  </Button>
                </motion.div>
              )}

            {/* Expanded search results section */}
            {showExpandedSection && expandedResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-sm text-muted-foreground px-2">
                    {t('maybeYouLookingFor', {
                      defaultValue: 'Maybe you\'re looking for "{query}"',
                      query: expandedQuery || '',
                    })}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <motion.div layout className="space-y-3">
                  <AnimatePresence>
                    {expandedResults.map((result, index) => (
                      <SearchResultItem
                        key={`expanded-${result.tmdbId || result.imdbId}-${index}`}
                        {...result}
                        onAddedToList={handleAddedFromSearch}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}

            {/* Show message when expanded search found nothing */}
            {showExpandedSection && expandedResults.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-muted-foreground">
                  {t('noExpandedResults', { defaultValue: 'No additional results found' })}
                </p>
              </div>
            )}
          </>
        )
      ) : // Local list
      isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive">
          <p>{error}</p>
          <button
            onClick={fetchItems}
            className="mt-4 text-primary hover:underline"
          >
            {t('tryAgain', { defaultValue: 'Try again' })}
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-4xl">📋</div>
          <p className="text-muted-foreground">
            {searchQuery || searchFilters.genres.length > 0 || searchFilters.yearFrom || searchFilters.yearTo || searchFilters.ratingMin
              ? t('noSearchResults', { defaultValue: 'No movies found' })
              : t('emptyList', { defaultValue: 'Your list is empty' })}
          </p>
          {!searchQuery && items.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground/70">
              {t('emptyListHint', {
                defaultValue: 'Swipe right on movies you like to add them here!',
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <MovieListItem
              key={item.id}
              {...item}
              onStatusChange={(status) => handleStatusChange(item.tmdbId, status)}
              onRatingChange={(rating) => handleRatingChange(item.tmdbId, rating)}
              onRemove={() => handleRemove(item.tmdbId)}
              onWatchComplete={(rating) => handleWatchComplete(item.tmdbId, rating)}
              onWatchNotYet={() => handleWatchNotYet(item.tmdbId)}
              showStatusBadge={statusFilter === 'all'}
              showRatingBadge={ratingFilter === null}
            />
          ))}
        </div>
      )}
      </ScrollFadeContainer>
    </div>
  );
}
