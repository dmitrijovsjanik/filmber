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
      onAddedToList,
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
          canAddToList={canAddToList}
          source={source}
        />
      </div>
    );
  }
);
