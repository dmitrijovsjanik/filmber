'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader } from '@/components/ui/Loader';

interface SimilarMovie {
  tmdbId: number;
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
}

interface SimilarMoviesSectionProps {
  tmdbId: number;
  onMovieClick: (tmdbId: number) => void;
}

export function SimilarMoviesSection({
  tmdbId,
  onMovieClick,
}: SimilarMoviesSectionProps) {
  const t = useTranslations('movie');
  const locale = useLocale();
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
    <div className="mt-4 flex-shrink-0">
      <h3 className="text-sm font-medium text-foreground mb-2">
        {t('similarMovies', { defaultValue: 'Similar movies' })}
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {movies.map((movie) => {
          const posterUrl = movie.posterPath
            ? `https://image.tmdb.org/t/p/w185${movie.posterPath}`
            : null;
          const displayTitle =
            locale === 'ru' && movie.titleRu ? movie.titleRu : movie.title;
          const year = movie.releaseDate
            ? new Date(movie.releaseDate).getFullYear()
            : null;

          return (
            <div
              key={movie.tmdbId}
              className="flex-shrink-0 w-20 cursor-pointer group"
              onClick={() => onMovieClick(movie.tmdbId)}
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🎬
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground truncate mt-1">
                {displayTitle}
              </p>
              {year && (
                <p className="text-xs text-muted-foreground">{year}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
