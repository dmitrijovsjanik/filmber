'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { MovieListItem } from './MovieListItem';
import { ListFilter } from './ListFilter';
import { SearchServiceTabs } from './SearchServiceTabs';
import { SearchResultItem } from './SearchResultItem';
import { SearchFilters } from './SearchFilters';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { useAuthToken } from '@/stores/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import type { SearchResult, SearchFilters as SearchFiltersType } from '@/types/movie';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
  overview: string | null;
  overviewRu: string | null;
  imdbRating: string | null;
  rottenTomatoesRating: string | null;
}

interface ListItem {
  id: string;
  tmdbId: number;
  status: MovieStatus;
  rating: number | null;
  movie: MovieData | null;
  watchStartedAt: string | null;
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

  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<MovieStatus | 'all'>(initialStatus);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 400);

  // Counts for list filters
  const [listCounts, setListCounts] = useState<FilterCounts>({
    all: 0,
    wantToWatch: 0,
    watched: 0,
    ratings: { 1: 0, 2: 0, 3: 0 },
  });

  // External search state
  const [searchMode, setSearchMode] = useState<'local' | 'tmdb' | 'omdb'>('local');
  const [searchResults, setSearchResults] = useState<{
    tmdb: SearchResult[];
    omdb: SearchResult[];
    tmdbCount: number;
    omdbCount: number;
  }>({ tmdb: [], omdb: [], tmdbCount: 0, omdbCount: 0 });
  const [isSearching, setIsSearching] = useState(false);

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

    // Sort
    if (searchFilters.sortBy !== 'relevance') {
      result.sort((a, b) => {
        switch (searchFilters.sortBy) {
          case 'popularity':
            // For local list, we don't have popularity data, so skip
            return 0;
          case 'rating':
            const ratingA = parseFloat(a.movie?.voteAverage || '0');
            const ratingB = parseFloat(b.movie?.voteAverage || '0');
            return ratingB - ratingA;
          case 'date_desc':
            const dateA = a.movie?.releaseDate || '0000';
            const dateB = b.movie?.releaseDate || '0000';
            return dateB.localeCompare(dateA);
          case 'date_asc':
            const dateA2 = a.movie?.releaseDate || '9999';
            const dateB2 = b.movie?.releaseDate || '9999';
            return dateA2.localeCompare(dateB2);
          default:
            return 0;
        }
      });
    }

    return result;
  }, [items, searchFilters]);

  // Fetch user's list items
  const fetchItems = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (ratingFilter !== null) {
        params.set('rating', ratingFilter.toString());
      }
      // Only pass search to local API when not doing external search
      if (searchQuery && searchMode === 'local') {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/lists?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      const data = await response.json();
      setItems(data.items);

      // Update counts from API response
      if (data.counts) {
        setListCounts(data.counts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter, ratingFilter, searchQuery, searchMode]);

  useEffect(() => {
    if (searchMode === 'local') {
      fetchItems();
    }
  }, [fetchItems, searchMode]);

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
      setSearchResults({ tmdb: [], omdb: [], tmdbCount: 0, omdbCount: 0 });
      setSearchMode('local');
      setCurrentPage(1);
      setTotalPages(0);
      setHasMore(false);
      // Reset expanded search
      setExpandedResults([]);
      setShowExpandedSection(false);
      setExpandedQuery(null);
      return;
    }

    // Switch to external search mode
    if (searchMode === 'local') {
      setSearchMode('tmdb');
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

        setSearchResults({
          tmdb: data.tmdb?.results || [],
          omdb: data.omdb?.results || [],
          tmdbCount: data.tmdb?.totalResults || 0,
          omdbCount: data.omdb?.totalResults || 0,
        });
        setTotalPages(data.tmdb?.totalPages || 0);
        setHasMore((data.tmdb?.page || 1) < (data.tmdb?.totalPages || 0));
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults({ tmdb: [], omdb: [], tmdbCount: 0, omdbCount: 0 });
        setHasMore(false);
      } finally {
        setIsSearching(false);
      }
    };

    searchExternalServices();
  }, [debouncedQuery, searchFilters, buildSearchUrl]);

  // Update item status
  const handleStatusChange = async (tmdbId: number, newStatus: MovieStatus) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.tmdbId === tmdbId ? { ...item, status: newStatus } : item
          )
        );
        // Refetch to update counts
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Update item rating
  const handleRatingChange = async (tmdbId: number, newRating: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: newRating || null }),
      });

      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.tmdbId === tmdbId ? { ...item, rating: newRating || null } : item
          )
        );
        // Refetch to update counts
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update rating:', err);
    }
  };

  // Remove item
  const handleRemove = async (tmdbId: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setItems((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
        // Refetch to update counts
        fetchItems();
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

  // Handle watch complete (from timer prompt)
  const handleWatchComplete = async (tmdbId: number, rating: number) => {
    if (!token) return;

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

      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.tmdbId === tmdbId
              ? { ...item, status: 'watched' as MovieStatus, rating, watchStartedAt: null }
              : item
          )
        );
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to mark as watched:', err);
    }
  };

  // Handle "not yet" (from timer prompt)
  const handleWatchNotYet = async (tmdbId: number) => {
    if (!token) return;

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

      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.tmdbId === tmdbId ? { ...item, watchStartedAt: null } : item
          )
        );
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
    }
  };

  // Get current search results based on selected service
  const currentSearchResults =
    searchMode === 'tmdb' ? searchResults.tmdb : searchResults.omdb;

  const isExternalSearch = searchMode === 'tmdb' || searchMode === 'omdb';

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder={t('searchPlaceholder', { defaultValue: 'Search movies...' })}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
          activeService={searchMode as 'tmdb' | 'omdb'}
          tmdbCount={searchResults.tmdbCount}
          omdbCount={searchResults.omdbCount}
          onServiceChange={setSearchMode}
          isSearching={isSearching}
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

      {/* Content */}
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
        <motion.div layout className="space-y-3">
          <AnimatePresence>
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
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
