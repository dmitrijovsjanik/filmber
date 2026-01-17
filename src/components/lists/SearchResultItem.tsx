'use client';

import { forwardRef, memo } from 'react';
import { MovieListItem } from './MovieListItem';
import { useListItemByTmdbId } from '@/stores/listStore';
import type { SearchResult } from '@/types/movie';

interface SearchResultItemProps extends SearchResult {
  onAddedToList?: () => void;
  showMediaTypeBadge?: boolean;
  priority?: boolean;
}

// Wrapped with memo to prevent unnecessary rerenders when list state changes
// Combined with O(1) _tmdbIdMap lookup in listStore for optimal performance
export const SearchResultItem = memo(
  forwardRef<HTMLDivElement, SearchResultItemProps>(function SearchResultItem(
    {
      tmdbId,
      imdbId,
      kinopoiskId,
      title,
      titleRu,
      posterPath,
      posterUrl,
      releaseDate,
      voteAverage,
      overview,
      overviewRu,
      runtime,
      genres,
      imdbRating,
      kinopoiskRating,
      source,
      mediaType,
      numberOfSeasons,
      numberOfEpisodes,
      onAddedToList,
      showMediaTypeBadge = true,
      priority = false,
    },
    ref
  ) {
    // Check if movie is already in user's list (only if we have a tmdbId)
    const listItem = useListItemByTmdbId(tmdbId || 0);
    const isInList = tmdbId && listItem;

    // Convert SearchResult to MovieData format for MovieListItem
    const movieData = {
      title,
      titleRu,
      posterPath: posterPath || null,
      posterUrl: posterUrl || null,
      releaseDate,
      voteAverage: voteAverage || null, // TMDB rating only
      genres: genres || null,
      runtime: runtime || null,
      overview,
      overviewRu,
      imdbRating: imdbRating || null,
      kinopoiskRating: kinopoiskRating || null,
      rottenTomatoesRating: null,
      mediaType: mediaType || 'movie',
      numberOfSeasons: numberOfSeasons || null,
      numberOfEpisodes: numberOfEpisodes || null,
    };

    // For non-TMDB results, we need to pass additional info
    const canAddToList = !!tmdbId;

    return (
      <div ref={ref}>
        <MovieListItem
          tmdbId={tmdbId || 0}
          imdbId={imdbId}
          kinopoiskId={kinopoiskId}
          movie={movieData}
          status={isInList ? listItem?.status : undefined}
          rating={isInList ? listItem?.rating : undefined}
          onAddedToList={onAddedToList}
          showStatusBadge={!!isInList}
          showRatingBadge={!!isInList}
          showMediaTypeBadge={showMediaTypeBadge}
          canAddToList={canAddToList}
          source={source}
          priority={priority}
        />
      </div>
    );
  })
);

SearchResultItem.displayName = 'SearchResultItem';
