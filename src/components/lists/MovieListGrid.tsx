'use client';

import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { MovieListSearchBar } from '@/components/molecules/MovieListSearchBar';
import { MovieListItem } from './MovieListItem';
import { ListFilter } from './ListFilter';
import { SearchResultItem } from './SearchResultItem';
import { SearchFilters } from './SearchFilters';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import { ScrollFadeContainer } from '@/components/ui/ScrollFadeContainer';
import { useMovieListLogic } from '@/hooks/useMovieListLogic';
import type { MovieStatus } from '@/lib/db/schema';

interface MovieListGridProps {
  initialStatus?: MovieStatus | 'all';
}

export function MovieListGrid({ initialStatus = 'all' }: MovieListGridProps) {
  const t = useTranslations('lists');
  const locale = useLocale();

  const {
    // State
    items,
    filteredItems,
    isLoading,
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
  } = useMovieListLogic({ initialStatus });

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header: Search + Filters */}
      <div className="flex-shrink-0 space-y-2 pb-4 bg-background">
        {/* Search */}
        <MovieListSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
        />

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
          <ExternalSearchContent
            t={t}
            isSearching={isSearching}
            searchResults={searchResults}
            lastElementRef={lastElementRef}
            handleAddedFromSearch={handleAddedFromSearch}
            searchFilters={searchFilters}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            debouncedQuery={debouncedQuery}
            canExpandSearch={canExpandSearch}
            showExpandedSection={showExpandedSection}
            handleExpandedSearch={handleExpandedSearch}
            isLoadingExpanded={isLoadingExpanded}
            expandedResults={expandedResults}
            expandedQuery={expandedQuery}
          />
        ) : (
          // Local list
          <LocalListContent
            t={t}
            isLoading={isLoading}
            error={error}
            filteredItems={filteredItems}
            items={items}
            searchQuery={searchQuery}
            searchFilters={searchFilters}
            statusFilter={statusFilter}
            ratingFilter={ratingFilter}
            handleStatusChange={handleStatusChange}
            handleRatingChange={handleRatingChange}
            handleRemove={handleRemove}
            handleWatchComplete={handleWatchComplete}
            handleWatchNotYet={handleWatchNotYet}
            fetchItems={fetchItems}
          />
        )}
      </ScrollFadeContainer>
    </div>
  );
}

// External search content component
function ExternalSearchContent({
  t,
  isSearching,
  searchResults,
  lastElementRef,
  handleAddedFromSearch,
  searchFilters,
  isLoadingMore,
  hasMore,
  debouncedQuery,
  canExpandSearch,
  showExpandedSection,
  handleExpandedSearch,
  isLoadingExpanded,
  expandedResults,
  expandedQuery,
}: {
  t: ReturnType<typeof useTranslations<'lists'>>;
  isSearching: boolean;
  searchResults: any[];
  lastElementRef: (node: HTMLElement | null) => void;
  handleAddedFromSearch: () => void;
  searchFilters: any;
  isLoadingMore: boolean;
  hasMore: boolean;
  debouncedQuery: string;
  canExpandSearch: (query: string) => boolean;
  showExpandedSection: boolean;
  handleExpandedSearch: () => void;
  isLoadingExpanded: boolean;
  expandedResults: any[];
  expandedQuery: string | null;
}) {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <p className="text-muted-foreground">
          {t('noSearchResults', { defaultValue: 'No movies found' })}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {searchResults.map((result, index) => (
          <SearchResultItem
            key={`${result.source}-${result.tmdbId || result.imdbId}-${index}`}
            ref={index === searchResults.length - 1 ? lastElementRef : null}
            {...result}
            onAddedToList={handleAddedFromSearch}
            showMediaTypeBadge={searchFilters.mediaType === 'all'}
          />
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader size="md" />
        </div>
      )}

      {/* Show More button */}
      {!isSearching &&
        !hasMore &&
        searchResults.length > 0 &&
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

          <div className="space-y-3">
            {expandedResults.map((result, index) => (
              <SearchResultItem
                key={`expanded-${result.tmdbId || result.imdbId}-${index}`}
                {...result}
                onAddedToList={handleAddedFromSearch}
                showMediaTypeBadge={searchFilters.mediaType === 'all'}
              />
            ))}
          </div>
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
  );
}

// Local list content component
function LocalListContent({
  t,
  isLoading,
  error,
  filteredItems,
  items,
  searchQuery,
  searchFilters,
  statusFilter,
  ratingFilter,
  handleStatusChange,
  handleRatingChange,
  handleRemove,
  handleWatchComplete,
  handleWatchNotYet,
  fetchItems,
}: {
  t: ReturnType<typeof useTranslations<'lists'>>;
  isLoading: boolean;
  error: string | null;
  filteredItems: any[];
  items: any[];
  searchQuery: string;
  searchFilters: any;
  statusFilter: string;
  ratingFilter: number | null;
  handleStatusChange: (tmdbId: number, status: any) => void;
  handleRatingChange: (tmdbId: number, rating: number) => void;
  handleRemove: (tmdbId: number) => void;
  handleWatchComplete: (tmdbId: number, rating: number) => void;
  handleWatchNotYet: (tmdbId: number) => void;
  fetchItems: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-destructive">
        <p>{error}</p>
        <button
          onClick={fetchItems}
          className="mt-4 text-primary hover:underline"
        >
          {t('tryAgain', { defaultValue: 'Try again' })}
        </button>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    const hasFilters = searchQuery || searchFilters.genres.length > 0 ||
      searchFilters.yearFrom || searchFilters.yearTo || searchFilters.ratingMin;

    return (
      <div className="py-12 text-center">
        <div className="mb-4 text-4xl">📋</div>
        <p className="text-muted-foreground">
          {hasFilters
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
    );
  }

  return (
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
  );
}
