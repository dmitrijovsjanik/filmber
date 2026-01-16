// Media type for movies and TV series
export type MediaType = 'movie' | 'tv';
export type MediaTypeFilter = 'all' | 'movie' | 'tv';

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
  // Media type (movie or TV series)
  mediaType: MediaType;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  // Ratings and metadata
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
  // Media type (movie or TV series)
  mediaType: MediaType;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  imdb_id: string | null;
  runtime: number;
  genres: { id: number; name: string }[];
}

// ============================================
// TMDB RELEASE DATES TYPES
// ============================================

// Release type enum from TMDB:
// 1 = Premiere, 2 = Theatrical (limited), 3 = Theatrical, 4 = Digital, 5 = Physical, 6 = TV
export type TMDBReleaseType = 1 | 2 | 3 | 4 | 5 | 6;

export interface TMDBReleaseDate {
  certification: string;
  descriptors: string[];
  iso_639_1: string; // Language code
  note: string;
  release_date: string; // ISO date format
  type: TMDBReleaseType;
}

export interface TMDBReleaseDateResult {
  iso_3166_1: string; // Country code (US, RU, etc.)
  release_dates: TMDBReleaseDate[];
}

export interface TMDBReleaseDates {
  id: number;
  results: TMDBReleaseDateResult[];
}

// Parsed release dates for easier use
export interface ParsedReleaseDates {
  theatricalUs: string | null;
  theatricalRu: string | null;
  digitalUs: string | null;
  digitalRu: string | null;
}

// ============================================
// TMDB TV SERIES TYPES
// ============================================

export interface TMDBTVSeries {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
}

export interface TMDBTVSeriesDetails extends TMDBTVSeries {
  external_ids?: {
    imdb_id: string | null;
  };
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  status: string;
  type: string;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  vote_average: number;
  still_path: string | null;
}

export interface TMDBSeason {
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  episode_count: number;
  poster_path: string | null;
  episodes?: TMDBEpisode[];
}

export interface TMDBVideo {
  id: string;
  key: string; // YouTube video ID
  name: string;
  site: string; // 'YouTube'
  type: string; // 'Trailer', 'Teaser', 'Clip', etc.
  official: boolean;
  published_at: string;
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
  originalLanguage?: string | null; // ISO 639-1 language code
  // Ratings from various sources
  imdbRating?: string | null;
  kinopoiskRating?: string | null;
  // Media type (movie or TV series)
  mediaType?: MediaType;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
}

export type SortOption = 'relevance' | 'popularity' | 'rating' | 'date_desc' | 'date_asc';

// Original language codes (ISO 639-1)
export type OriginalLanguage = 'en' | 'ru' | 'ko' | 'ja' | 'fr' | 'de' | 'es' | 'it' | 'zh' | 'hi' | 'tr';

// Default languages for filtering (empty = all languages)
export const DEFAULT_LANGUAGES: OriginalLanguage[] = [];

export interface SearchFilters {
  genres: number[];
  // Genre names for filtering old-format data (EN + RU names)
  genreNames: string[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  sortBy: SortOption;
  mediaType: MediaTypeFilter;
  // Language filter (array for multi-select)
  originalLanguages: OriginalLanguage[];
  runtimeMin: number | null; // minutes (movies only)
  runtimeMax: number | null; // minutes (movies only)
}
