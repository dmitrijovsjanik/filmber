export interface MovieRatings {
  tmdb: string;
  imdb: string | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
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
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  titleRu: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: string | null;
  voteCount?: number | null;
  popularity?: number | null;
  overview: string | null;
  overviewRu: string | null;
  source: 'tmdb' | 'omdb';
  // Extended data (available for cached movies)
  runtime?: number | null;
  genres?: string | null; // JSON array string
  genreIds?: number[] | null; // For filtering
  imdbRating?: string | null;
}

export type SortOption = 'relevance' | 'popularity' | 'rating' | 'date_desc' | 'date_asc';

export interface SearchFilters {
  genres: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  sortBy: SortOption;
}
