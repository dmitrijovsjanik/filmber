'use client';

import { useState, useEffect } from 'react';

interface Genre {
  id: number;
  name: string;
  nameRu: string;
  type: 'movie' | 'tv';
}

interface GenresResponse {
  movie: Genre[];
  tv: Genre[];
}

// Simple module-level cache
let cachedGenres: GenresResponse | null = null;
let fetchPromise: Promise<GenresResponse> | null = null;

export function useGenresList() {
  const [genresData, setGenresData] = useState<GenresResponse>(
    cachedGenres || { movie: [], tv: [] }
  );
  const [isLoading, setIsLoading] = useState(!cachedGenres);

  useEffect(() => {
    // If already cached, use it
    if (cachedGenres) {
      setGenresData(cachedGenres);
      setIsLoading(false);
      return;
    }

    // If fetch is in progress, wait for it
    if (fetchPromise) {
      fetchPromise.then((data) => {
        setGenresData(data);
        setIsLoading(false);
      });
      return;
    }

    // Start new fetch
    fetchPromise = fetch('/api/genres')
      .then((res) => res.json())
      .then((data: GenresResponse) => {
        cachedGenres = data;
        return data;
      })
      .catch((error) => {
        console.error('Failed to fetch genres:', error);
        return { movie: [], tv: [] };
      })
      .finally(() => {
        fetchPromise = null;
      });

    fetchPromise.then((data) => {
      setGenresData(data);
      setIsLoading(false);
    });
  }, []);

  return { genresData, isLoading };
}
