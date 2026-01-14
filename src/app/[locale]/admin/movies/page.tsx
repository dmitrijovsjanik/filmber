'use client';

import { DataTable } from '@/components/admin/DataTable';

interface MovieData {
  id: string;
  tmdbId: number | null;
  imdbId: string | null;
  kinopoiskId: number | null;
  title: string;
  titleRu: string | null;
  releaseDate: string | null;
  mediaType: string;
  tmdbRating: string | null;
  imdbRating: string | null;
  kinopoiskRating: string | null;
  primarySource: string;
  cachedAt: string;
}

export default function MoviesPage() {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getYear = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return dateStr.substring(0, 4);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Movies</h2>
      <DataTable<MovieData>
        endpoint="/api/admin/movies"
        searchPlaceholder="Search movies..."
        columns={[
          {
            key: 'title',
            header: 'Title',
            render: (item) => (
              <div>
                <div className="font-medium">{item.titleRu || item.title}</div>
                {item.titleRu && item.title !== item.titleRu && (
                  <div className="text-xs text-muted-foreground">
                    {item.title}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'releaseDate',
            header: 'Year',
            render: (item) => getYear(item.releaseDate),
            className: 'text-center',
          },
          {
            key: 'mediaType',
            header: 'Type',
            render: (item) => (
              <span className="rounded bg-muted px-2 py-0.5 text-xs">
                {item.mediaType === 'tv' ? 'TV' : 'Movie'}
              </span>
            ),
          },
          {
            key: 'ratings',
            header: 'Ratings',
            render: (item) => (
              <div className="flex flex-col gap-0.5 text-xs">
                {item.tmdbRating && <span>TMDB: {item.tmdbRating}</span>}
                {item.imdbRating && <span>IMDB: {item.imdbRating}</span>}
                {item.kinopoiskRating && <span>KP: {item.kinopoiskRating}</span>}
              </div>
            ),
          },
          {
            key: 'ids',
            header: 'IDs',
            render: (item) => (
              <div className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
                {item.tmdbId && <span>tmdb:{item.tmdbId}</span>}
                {item.imdbId && <span>imdb:{item.imdbId}</span>}
                {item.kinopoiskId && <span>kp:{item.kinopoiskId}</span>}
              </div>
            ),
          },
          {
            key: 'cachedAt',
            header: 'Cached',
            render: (item) => formatDate(item.cachedAt),
            className: 'text-xs',
          },
        ]}
      />
    </div>
  );
}
