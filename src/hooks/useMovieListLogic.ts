'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthToken } from '@/stores/authStore';
import { useListStore } from '@/stores/listStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useClearSearchTrigger } from '@/stores/searchStore';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import type { SearchResult, SearchFilters as SearchFiltersType, OriginalLanguage } from '@/types/movie';
import { DEFAULT_LANGUAGES } from '@/types/movie';

interface UseMovieListLogicProps {
  initialStatus?: MovieStatus | 'all';
}

export function useMovieListLogic({ initialStatus = 'all' }: UseMovieListLogicProps = {}) {
  const token = useAuthToken();
  const clearSearchTrigger = useClearSearchTrigger();
  const { trackMovieRemoved, trackListSearchUsed } = useAnalytics();

  // Use listStore directly - no more local items state duplication
  const {
    cache,
    hasHydrated,
    isFetching,
    setCache,
    updateItem,
    removeItem: removeItemFromCache,
    isCacheValid,
    isCacheStale,
    setLoading,
    setFetching,
  } = useListStore();

  // Get items directly from cache - memoized to avoid unnecessary recalculations
  const items = useMemo(() => cache?.items ?? [], [cache?.items]);
  const listCounts = useMemo(() => cache?.counts ?? {
    all: 0,
    wantToWatch: 0,
    watched: 0,
    ratings: { 1: 0, 2: 0, 3: 0 },
  }, [cache?.counts]);

  // Local loading state for initial fetch only
  const [isInitialLoading, setIsInitialLoading] = useState(!cache);
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

  // External search state
  const [isExternalSearch, setIsExternalSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasTrackedSearch, setHasTrackedSearch] = useState(false);

  // Pagination state for infinite scroll
  const [currentPage, setCurrentPage] = useState(1);
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
    genreNames: [],
    yearFrom: null,
    yearTo: null,
    ratingMin: null,
    sortBy: 'relevance',
    mediaType: 'all',
    originalLanguages: DEFAULT_LANGUAGES,
    runtimeMin: null,
    runtimeMax: null,
  });

  // Apply filters and sorting to items from store
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by status (from ListFilter tabs)
    if (statusFilter !== 'all') {
      result = result.filter((item) =>
        item.status === statusFilter || item.status === MOVIE_STATUS.WATCHING
      );
    }

    // Filter by rating (from ListFilter tabs, only for watched)
    if (ratingFilter !== null) {
      result = result.filter((item) => item.rating === ratingFilter);
    }

    // Filter by media type (movie/tv)
    if (searchFilters.mediaType !== 'all') {
      result = result.filter((item) => {
        if (!item.movie?.mediaType) return true; // Keep items without mediaType
        return item.movie.mediaType === searchFilters.mediaType;
      });
    }

    // Filter by genres
    if (searchFilters.genres.length > 0) {
      result = result.filter((item) => {
        if (!item.movie?.genres) return false;
        try {
          const parsed = JSON.parse(item.movie.genres);
          if (!Array.isArray(parsed) || parsed.length === 0) return false;

          // Check format: new format has objects with id, old format has strings
          if (typeof parsed[0] === 'object' && parsed[0] !== null && 'id' in parsed[0]) {
            // New format: [{ id: 10, name: "Action" }]
            const movieGenres: { id: number; name: string }[] = parsed;
            return searchFilters.genres.some((gId) =>
              movieGenres.some((g) => g.id === gId)
            );
          }
          // Old format: ["Action", "Adventure"] - filter by name
          if (searchFilters.genreNames.length > 0) {
            const movieGenreStrings: string[] = parsed.map((g: string) => g.toLowerCase());
            return searchFilters.genreNames.some((name) =>
              movieGenreStrings.includes(name)
            );
          }
          return false;
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

    // Filter by original language
    if (searchFilters.originalLanguages.length > 0) {
      // Check if user has all default languages (for backwards compatibility with old data without originalLanguage)
      const hasAllDefaultLangs = DEFAULT_LANGUAGES.every(lang =>
        searchFilters.originalLanguages.includes(lang)
      );

      result = result.filter((item) => {
        // If movie has no language info:
        // - Keep if user has all default languages selected (backwards compatible)
        // - Exclude if user narrowed search (removed some default languages)
        if (!item.movie?.originalLanguage) return hasAllDefaultLangs;
        return searchFilters.originalLanguages.includes(item.movie.originalLanguage as OriginalLanguage);
      });
    }

    // Sort: watching movies always first, then apply selected sort
    result.sort((a, b) => {
      const aIsWatching = a.status === MOVIE_STATUS.WATCHING ? 1 : 0;
      const bIsWatching = b.status === MOVIE_STATUS.WATCHING ? 1 : 0;
      if (aIsWatching !== bIsWatching) {
        return bIsWatching - aIsWatching;
      }

      if (searchFilters.sortBy === 'relevance') {
        return 0;
      }

      switch (searchFilters.sortBy) {
        case 'popularity':
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
      setLoading(true);
      setIsInitialLoading(true);
    } else {
      setFetching(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/lists', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      const data = await response.json();

      setCache(data.items, data.counts || {
        all: data.items.length,
        wantToWatch: 0,
        watched: 0,
        ratings: { 1: 0, 2: 0, 3: 0 },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setFetching(false);
      setIsInitialLoading(false);
    }
  }, [token, setCache, setLoading, setFetching]);

  // Initialize from cache or fetch - optimized for instant cache display
  useEffect(() => {
    if (!hasHydrated || !token) return;
    if (isExternalSearch) return;

    // If we have valid cache, show it immediately (already done via items from cache)
    // Only fetch if cache is invalid or stale
    if (isCacheValid()) {
      setIsInitialLoading(false);
      // Background refresh if stale
      if (isCacheStale()) {
        fetchFromApi(true);
      }
    } else {
      // No valid cache - fetch data
      fetchFromApi(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, token, isExternalSearch]);

  // Refetch callback
  const fetchItems = useCallback(async () => {
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
      if (searchFilters.mediaType !== 'all') {
        params.set('mediaType', searchFilters.mediaType);
      }
      if (searchFilters.originalLanguages.length > 0) {
        params.set('originalLanguages', searchFilters.originalLanguages.join(','));
      }
      if (searchFilters.runtimeMin) {
        params.set('runtimeMin', String(searchFilters.runtimeMin));
      }
      if (searchFilters.runtimeMax) {
        params.set('runtimeMax', String(searchFilters.runtimeMax));
      }

      return `/api/search?${params}`;
    },
    [searchFilters]
  );

  // External search effect
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      setIsExternalSearch(false);
      setTotalResults(0);
      setCurrentPage(1);
      setHasMore(false);
      setExpandedResults([]);
      setShowExpandedSection(false);
      setExpandedQuery(null);
      setHasTrackedSearch(false);
      return;
    }

    setIsExternalSearch(true);

    if (!hasTrackedSearch) {
      trackListSearchUsed();
      setHasTrackedSearch(true);
    }

    setCurrentPage(1);
    setExpandedResults([]);
    setShowExpandedSection(false);
    setExpandedQuery(null);

    const searchTMDB = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(buildSearchUrl(debouncedQuery, 1));
        const data = await response.json();

        setSearchResults(data.tmdb?.results || []);
        setTotalResults(data.tmdb?.totalResults || 0);
        setHasMore((data.tmdb?.page || 1) < (data.tmdb?.totalPages || 0));
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
        setTotalResults(0);
        setHasMore(false);
      } finally {
        setIsSearching(false);
      }
    };

    searchTMDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, searchFilters, buildSearchUrl]);

  // Update item status - optimistic update directly in store
  const handleStatusChange = async (tmdbId: number, newStatus: MovieStatus) => {
    if (!token) return;

    // Optimistic update in store only
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
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchItems();
    }
  };

  // Update item rating - optimistic update
  const handleRatingChange = async (tmdbId: number, newRating: number) => {
    if (!token) return;

    const rating = newRating || null;

    // Optimistic update in store only
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
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update rating:', err);
      fetchItems();
    }
  };

  // Remove item - optimistic update
  const handleRemove = async (tmdbId: number) => {
    if (!token) return;

    trackMovieRemoved(tmdbId);
    // Optimistic update in store only
    removeItemFromCache(tmdbId);

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  // Handle adding from search results
  const handleAddedFromSearch = () => {
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

      setSearchResults((prev) => [...prev, ...(data.tmdb?.results || [])]);
      setTotalResults(data.tmdb?.totalResults || 0);

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

  // Check if expanded search is available
  const canExpandSearch = useCallback((query: string): boolean => {
    const words = query.trim().split(/\s+/);
    return words.length >= 2;
  }, []);

  // Get broader query
  const getBroaderQuery = useCallback((query: string): string => {
    const words = query.trim().split(/\s+/);
    return words.slice(0, -1).join(' ');
  }, []);

  // Handle expanded search
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

      const existingIds = new Set(searchResults.map((r) => r.tmdbId));
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
  }, [debouncedQuery, canExpandSearch, getBroaderQuery, searchResults]);

  // Handle watch complete
  const handleWatchComplete = async (tmdbId: number, rating: number) => {
    if (!token) return;

    const updates = { status: 'watched' as MovieStatus, rating, watchStartedAt: null };
    // Optimistic update in store only
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
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to mark as watched:', err);
      fetchItems();
    }
  };

  // Handle "not finished"
  const handleWatchNotYet = async (tmdbId: number) => {
    if (!token) return;

    const updates = {
      status: MOVIE_STATUS.WANT_TO_WATCH as MovieStatus,
      rating: null,
      watchStartedAt: null,
    };
    // Optimistic update in store only
    updateItem(tmdbId, updates);

    try {
      const response = await fetch(`/api/lists/${tmdbId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: MOVIE_STATUS.WANT_TO_WATCH,
          rating: null,
          watchStartedAt: null,
        }),
      });

      if (!response.ok) {
        fetchItems();
      }
    } catch (err) {
      console.error('Failed to update watch status:', err);
      fetchItems();
    }
  };

  // Combined loading state - show loading only when no cached data and fetching
  const isLoading = !hasHydrated || (isInitialLoading && items.length === 0);

  return {
    // State
    items,
    filteredItems,
    isLoading,
    isFetching,
    error,
    listCounts,

    // Filters
    statusFilter,
    setStatusFilter,
    ratingFilter,
    setRatingFilter,
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    searchFilters,
    setSearchFilters,

    // External search
    isExternalSearch,
    searchResults,
    totalResults,
    isSearching,

    // Pagination
    hasMore,
    isLoadingMore,
    lastElementRef,

    // Expanded search
    expandedResults,
    expandedQuery,
    showExpandedSection,
    isLoadingExpanded,
    canExpandSearch,
    handleExpandedSearch,

    // Actions
    handleStatusChange,
    handleRatingChange,
    handleRemove,
    handleAddedFromSearch,
    handleWatchComplete,
    handleWatchNotYet,
    fetchItems,
  };
}
