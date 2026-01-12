export interface MovieRatings {
  tmdb: string;
  imdb: string | null;
  kinopoisk: string | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
}

// ============================================
// KINOPOISK TYPES
// ============================================

export interface KinopoiskFilm {
  kinopoiskId: number;
  imdbId: string | null;
  nameRu: string | null;
  nameEn: string | null;
  nameOriginal: string | null;
  posterUrl: string | null;
  posterUrlPreview: string | null;
  coverUrl: string | null;
  ratingKinopoisk: number | null;
  ratingImdb: number | null;
  year: number | null;
  filmLength: number | null;
  description: string | null;
  shortDescription: string | null;
  countries: { country: string }[];
  genres: { genre: string }[];
  type: 'FILM' | 'TV_SERIES' | 'TV_SHOW' | 'MINI_SERIES' | 'VIDEO';
}

export interface KinopoiskSearchResult {
  kinopoiskId: number;
  imdbId: string | null;
  nameRu: string | null;
  nameEn: string | null;
  nameOriginal: string | null;
  posterUrl: string | null;
  posterUrlPreview: string | null;
  ratingKinopoisk: number | null;
  ratingImdb: number | null;
  year: number | null;
  filmLength: string | null;
  countries: { country: string }[];
  genres: { genre: string }[];
  type: 'FILM' | 'TV_SERIES' | 'TV_SHOW' | 'MINI_SERIES' | 'VIDEO';
}

export interface KinopoiskSearchResponse {
  keyword: string;
  pagesCount: number;
  searchFilmsCountResult: number;
  films: KinopoiskSearchResult[];
}

// ============================================
// UNIFIED MOVIE (internal database)
// ============================================

export type MovieSource = 'tmdb' | 'omdb' | 'kinopoisk';

export interface UnifiedMovie {
  id: string; // UUID
  tmdbId: number | null;
  imdbId: string | null;
  kinopoiskId: number | null;
  title: string;
  titleRu: string | null;
  titleOriginal: string | null;
  overview: string | null;
  overviewRu: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  genres: string | null;
  ratings: MovieRatings;
  primarySource: MovieSource;
  cachedAt: Date;
  updatedAt: Date;
}

export interface Movie {
  tmdbId: number;
  title: string;
  titleRu: string | null;
  overview: string;
  overviewRu: string | null;
  posterUrl: string;
  releaseDate: string;
  ratings: MovieRatings;
  genres: string[];
  runtime: number | null;
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

export interface TMDBMovieDetails extends TMDBMovie {
  imdb_id: string | null;
  runtime: number;
  genres: { id: number; name: string }[];
}

export interface OMDBRating {
  Source: string;
  Value: string;
}

export interface OMDBMovie {
  imdbRating: string;
  Metascore: string;
  Ratings: OMDBRating[];
  Response: string;
}

export interface OMDBSearchResult {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OMDBSearchResponse {
  Search?: OMDBSearchResult[];
  totalResults?: string;
  Response: string;
  Error?: string;
}

export interface SearchResult {
  // Internal movie ID (if already in our database)
  movieId?: string | null;
  // External IDs
  tmdbId: number | null;
  imdbId: string | null;
  kinopoiskId?: number | null;
  // Core data
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  posterUrl?: string | null; // Direct URL for Kinopoisk
  releaseDate: string | null;
  voteAverage: string | null;
  voteCount?: number | null;
  popularity?: number | null;
  overview: string | null;
  overviewRu: string | null;
  source: MovieSource;
  // Extended data (available for cached movies)
  runtime?: number | null;
  genres?: string | null; // JSON array string
  genreIds?: number[] | null; // For filtering
  // Ratings from various sources
  imdbRating?: string | null;
  kinopoiskRating?: string | null;
}

export type SortOption = 'relevance' | 'popularity' | 'rating' | 'date_desc' | 'date_asc';

export interface SearchFilters {
  genres: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  sortBy: SortOption;
}
