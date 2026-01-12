'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader } from '@/components/ui/Loader';
import { SearchResultItem } from './SearchResultItem';

interface SimilarMovie {
  tmdbId: number;
  imdbId: string | null;
  kinopoiskId: number | null;
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  overview: string | null;
  overviewRu: string | null;
  runtime: number | null;
  genres: string | null;
  imdbRating: string | null;
  kinopoiskRating: string | null;
}

interface SimilarMoviesSectionProps {
  tmdbId: number;
  onMovieClick?: (tmdbId: number) => void;
}

export function SimilarMoviesSection({
  tmdbId,
  onMovieClick,
}: SimilarMoviesSectionProps) {
  const t = useTranslations('movie');
  const [movies, setMovies] = useState<SimilarMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSimilar() {
      setIsLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/movies/${tmdbId}/similar`);

        if (!response.ok) {
          throw new Error('Failed to fetch');
        }

        const data = await response.json();

        if (!cancelled) {
          setMovies(data.movies || []);
        }
      } catch (err) {
        console.error('Failed to fetch similar movies:', err);
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchSimilar();

    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  // Don't render if loading, error, or no movies
  if (isLoading) {
    return (
      <div className="mt-4 flex justify-center py-4">
        <Loader size="sm" />
      </div>
    );
  }

  if (error || movies.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex-shrink-0">
      <h3 className="text-sm font-medium text-foreground mb-3">
        {t('similarMovies', { defaultValue: 'Similar movies' })}
      </h3>
      <div className="space-y-2">
        {movies.map((movie) => (
          <SearchResultItem
            key={movie.tmdbId}
            tmdbId={movie.tmdbId}
            imdbId={movie.imdbId}
            kinopoiskId={movie.kinopoiskId}
            title={movie.title}
            titleRu={movie.titleRu}
            posterPath={movie.posterPath}
            posterUrl={movie.posterUrl}
            releaseDate={movie.releaseDate}
            voteAverage={movie.voteAverage}
            overview={movie.overview}
            overviewRu={movie.overviewRu}
            runtime={movie.runtime}
            genres={movie.genres}
            imdbRating={movie.imdbRating}
            kinopoiskRating={movie.kinopoiskRating}
            source="tmdb"
            onAddedToList={() => onMovieClick?.(movie.tmdbId)}
          />
        ))}
      </div>
    </div>
  );
}
