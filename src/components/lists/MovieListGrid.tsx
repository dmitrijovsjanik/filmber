'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { MovieListItem } from './MovieListItem';
import { ListFilter } from './ListFilter';
import { SearchServiceTabs } from './SearchServiceTabs';
import { SearchResultItem } from './SearchResultItem';
import { Loader } from '@/components/ui/Loader';
import { useAuthToken } from '@/stores/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { MOVIE_STATUS, type MovieStatus } from '@/lib/db/schema';
import type { SearchResult } from '@/types/movie';

interface MovieData {
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  genres: string | null;
  runtime: number | null;
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

  // External search effect
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults({ tmdb: [], omdb: [], tmdbCount: 0, omdbCount: 0 });
      setSearchMode('local');
      return;
    }

    // Switch to external search mode
    if (searchMode === 'local') {
      setSearchMode('tmdb');
    }

    const searchExternalServices = async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/search?query=${encodeURIComponent(debouncedQuery)}`
        );
        const data = await response.json();

        setSearchResults({
          tmdb: data.tmdb?.results || [],
          omdb: data.omdb?.results || [],
          tmdbCount: data.tmdb?.totalResults || 0,
          omdbCount: data.omdb?.totalResults || 0,
        });
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults({ tmdb: [], omdb: [], tmdbCount: 0, omdbCount: 0 });
      } finally {
        setIsSearching(false);
      }
    };

    searchExternalServices();
  }, [debouncedQuery]);

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
          className="w-full rounded-lg bg-gray-800 px-4 py-3 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          🔍
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            ✕
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

      {/* Filters (when viewing local list) */}
      {!isExternalSearch && (
        <ListFilter
          status={statusFilter}
          rating={ratingFilter}
          onStatusChange={setStatusFilter}
          onRatingChange={setRatingFilter}
          counts={listCounts}
        />
      )}

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
            <p className="text-gray-400">
              {t('noSearchResults', { defaultValue: 'No movies found' })}
            </p>
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence>
              {currentSearchResults.map((result, index) => (
                <SearchResultItem
                  key={`${result.source}-${result.tmdbId || result.imdbId}-${index}`}
                  {...result}
                  onAddedToList={handleAddedFromSearch}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )
      ) : // Local list
      isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">
          <p>{error}</p>
          <button
            onClick={fetchItems}
            className="mt-4 text-emerald-400 hover:underline"
          >
            {t('tryAgain', { defaultValue: 'Try again' })}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-4xl">📋</div>
          <p className="text-gray-400">
            {searchQuery
              ? t('noSearchResults', { defaultValue: 'No movies found' })
              : t('emptyList', { defaultValue: 'Your list is empty' })}
          </p>
          {!searchQuery && (
            <p className="mt-2 text-sm text-gray-500">
              {t('emptyListHint', {
                defaultValue: 'Swipe right on movies you like to add them here!',
              })}
            </p>
          )}
        </div>
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence>
            {items.map((item) => (
              <MovieListItem
                key={item.id}
                {...item}
                onStatusChange={(status) => handleStatusChange(item.tmdbId, status)}
                onRatingChange={(rating) => handleRatingChange(item.tmdbId, rating)}
                onRemove={() => handleRemove(item.tmdbId)}
                onWatchComplete={(rating) => handleWatchComplete(item.tmdbId, rating)}
                onWatchNotYet={() => handleWatchNotYet(item.tmdbId)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
