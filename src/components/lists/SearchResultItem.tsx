'use client';

import { forwardRef } from 'react';
import { MovieListItem } from './MovieListItem';
import { useListItemByTmdbId } from '@/stores/listStore';
import type { SearchResult } from '@/types/movie';

interface SearchResultItemProps extends SearchResult {
  onAddedToList?: () => void;
}

export const SearchResultItem = forwardRef<HTMLDivElement, SearchResultItemProps>(
  function SearchResultItem(
    {
      tmdbId,
      title,
      titleRu,
      posterPath,
      releaseDate,
      voteAverage,
      overview,
      overviewRu,
      runtime,
      genres,
      imdbRating,
      onAddedToList,
    },
    ref
  ) {
    // Skip non-TMDB results (they can't be added to list)
    if (!tmdbId) {
      return null;
    }

    // Check if movie is already in user's list
    const listItem = useListItemByTmdbId(tmdbId);

    // Convert SearchResult to MovieData format for MovieListItem
    const movieData = {
      title,
      titleRu,
      posterPath,
      releaseDate,
      voteAverage,
      genres: genres || null,
      runtime: runtime || null,
      overview,
      overviewRu,
      imdbRating: imdbRating || null,
      rottenTomatoesRating: null,
    };

    return (
      <div ref={ref}>
        <MovieListItem
          tmdbId={tmdbId}
          movie={movieData}
          status={listItem?.status}
          rating={listItem?.rating}
          onAddedToList={onAddedToList}
          showStatusBadge={!!listItem}
          showRatingBadge={!!listItem}
        />
      </div>
    );
  }
);
