import { db } from '@/lib/db';
import { movies, type Movie, type NewMovie } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { tmdb, TMDBClient } from '@/lib/api/tmdb';
import { omdb, OMDBClient } from '@/lib/api/omdb';
import { kinopoisk } from '@/lib/api/kinopoisk';
import { posterService } from '@/lib/services/posterService';
import type { MovieSource, SearchResult, KinopoiskSearchResult } from '@/types/movie';

// Cache duration: 30 days
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

interface ExternalIds {
  tmdbId?: number | null;
  imdbId?: string | null;
  kinopoiskId?: number | null;
}

interface FindOrCreateParams extends ExternalIds {
  title?: string;
  titleRu?: string;
  source?: MovieSource;
}

class MovieService {
  /**
   * Find a movie by any external ID
   */
  async findByExternalId(ids: ExternalIds): Promise<Movie | null> {
    const conditions = [];

    if (ids.tmdbId) {
      conditions.push(eq(movies.tmdbId, ids.tmdbId));
    }
    if (ids.imdbId) {
      conditions.push(eq(movies.imdbId, ids.imdbId));
    }
    if (ids.kinopoiskId) {
      conditions.push(eq(movies.kinopoiskId, ids.kinopoiskId));
    }

    if (conditions.length === 0) {
      return null;
    }

    const result = await db
      .select()
      .from(movies)
      .where(or(...conditions))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a movie by internal UUID
   */
  async findById(id: string): Promise<Movie | null> {
    const result = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
    return result[0] || null;
  }

  /**
   * Check if movie data needs refresh
   */
  isStale(movie: Movie): boolean {
    const now = Date.now();
    const cachedAt = new Date(movie.cachedAt).getTime();
    return now - cachedAt > CACHE_DURATION_MS;
  }

  /**
   * Find or create a movie by external ID
   * Will fetch data from the appropriate API if not found
   */
  async findOrCreate(params: FindOrCreateParams): Promise<Movie | null> {
    // First, try to find existing movie
    const existing = await this.findByExternalId(params);
    if (existing && !this.isStale(existing)) {
      return existing;
    }

    // If found but stale, refresh in background
    if (existing) {
      this.enrichMovie(existing.id).catch(console.error);
      return existing;
    }

    // Create new movie from available data
    return this.createFromSource(params);
  }

  /**
   * Create a movie from external source data
   */
  private async createFromSource(params: FindOrCreateParams): Promise<Movie | null> {
    let movieData: NewMovie | null = null;

    // Try TMDB first
    if (params.tmdbId) {
      movieData = await this.fetchFromTMDB(params.tmdbId);
    }

    // Try Kinopoisk if no TMDB data
    if (!movieData && params.kinopoiskId) {
      movieData = await this.fetchFromKinopoisk(params.kinopoiskId);
    }

    // Try OMDB if we have IMDB ID
    if (!movieData && params.imdbId) {
      movieData = await this.fetchFromOMDB(params.imdbId);
    }

    if (!movieData) {
      return null;
    }

    // Insert into database
    const result = await db.insert(movies).values(movieData).returning();
    const movie = result[0];

    if (!movie) {
      return null;
    }

    // Download and save poster locally (in background to not block response)
    const sourceUrl = posterService.getSourceUrl(movieData.posterPath || null, movieData.posterUrl || null);
    if (sourceUrl) {
      posterService.downloadAndSave(sourceUrl, movie.id).then((localPath) => {
        if (localPath) {
          db.update(movies)
            .set({ localPosterPath: localPath })
            .where(eq(movies.id, movie.id))
            .catch(console.error);
        }
      }).catch(console.error);
    }

    return movie;
  }

  /**
   * Fetch movie data from TMDB
   */
  private async fetchFromTMDB(tmdbId: number): Promise<NewMovie | null> {
    try {
      const [detailsEn, detailsRu] = await Promise.all([
        tmdb.getMovieDetails(tmdbId, 'en-US'),
        tmdb.getMovieDetails(tmdbId, 'ru-RU'),
      ]);

      // Get OMDB data for additional ratings
      let omdbData = null;
      if (detailsEn.imdb_id) {
        omdbData = await omdb.getByImdbId(detailsEn.imdb_id);
      }

      return {
        tmdbId,
        imdbId: detailsEn.imdb_id || null,
        title: detailsEn.title,
        titleRu: detailsRu.title !== detailsEn.title ? detailsRu.title : null,
        titleOriginal: detailsEn.title,
        overview: detailsEn.overview,
        overviewRu: detailsRu.overview !== detailsEn.overview ? detailsRu.overview : null,
        posterPath: detailsEn.poster_path,
        backdropPath: detailsEn.backdrop_path,
        releaseDate: detailsEn.release_date,
        runtime: detailsEn.runtime,
        genres: JSON.stringify((detailsEn.genres || []).map((g) => g.name)),
        originalLanguage: detailsEn.original_language || null,
        tmdbRating: detailsEn.vote_average?.toString(),
        tmdbVoteCount: detailsEn.vote_count,
        tmdbPopularity: detailsEn.popularity?.toString(),
        imdbRating: omdbData?.imdbRating || null,
        rottenTomatoesRating: omdbData ? OMDBClient.getRottenTomatoesRating(omdbData.Ratings) : null,
        metacriticRating: omdbData ? OMDBClient.getMetacriticRating(omdbData.Ratings) : null,
        primarySource: 'tmdb',
      };
    } catch (error) {
      console.error('Failed to fetch from TMDB:', error);
      return null;
    }
  }

  /**
   * Fetch movie data from Kinopoisk
   */
  private async fetchFromKinopoisk(kinopoiskId: number): Promise<NewMovie | null> {
    try {
      const details = await kinopoisk.getMovieDetails(kinopoiskId);
      if (!details) return null;

      return {
        kinopoiskId,
        imdbId: details.imdbId || null,
        title: details.nameOriginal || details.nameEn || details.nameRu || 'Unknown',
        titleRu: details.nameRu,
        titleOriginal: details.nameOriginal,
        overview: details.description,
        overviewRu: details.description, // Kinopoisk returns Russian by default
        posterUrl: details.posterUrl,
        releaseDate: details.year?.toString(),
        runtime: details.filmLength,
        genres: JSON.stringify(details.genres?.map((g) => g.genre) || []),
        kinopoiskRating: details.ratingKinopoisk?.toString(),
        imdbRating: details.ratingImdb?.toString(),
        primarySource: 'kinopoisk',
      };
    } catch (error) {
      console.error('Failed to fetch from Kinopoisk:', error);
      return null;
    }
  }

  /**
   * Fetch movie data from OMDB (limited data)
   */
  private async fetchFromOMDB(imdbId: string): Promise<NewMovie | null> {
    try {
      const data = await omdb.getByImdbId(imdbId);
      if (!data) return null;

      // OMDB doesn't have full movie details endpoint for search results
      // This is a minimal implementation
      return {
        imdbId,
        title: imdbId, // We don't have title from this endpoint
        imdbRating: data.imdbRating,
        rottenTomatoesRating: OMDBClient.getRottenTomatoesRating(data.Ratings),
        metacriticRating: OMDBClient.getMetacriticRating(data.Ratings),
        primarySource: 'omdb',
      };
    } catch (error) {
      console.error('Failed to fetch from OMDB:', error);
      return null;
    }
  }

  /**
   * Enrich movie data from all available sources
   */
  async enrichMovie(movieId: string): Promise<Movie | null> {
    const movie = await this.findById(movieId);
    if (!movie) return null;

    const updates: Partial<NewMovie> = {
      updatedAt: new Date(),
    };

    // Fetch missing data from TMDB if we have tmdbId
    if (movie.tmdbId && !movie.tmdbRating) {
      const tmdbData = await this.fetchFromTMDB(movie.tmdbId);
      if (tmdbData) {
        Object.assign(updates, {
          title: tmdbData.title,
          titleRu: tmdbData.titleRu,
          overview: tmdbData.overview,
          overviewRu: tmdbData.overviewRu,
          posterPath: tmdbData.posterPath,
          backdropPath: tmdbData.backdropPath,
          releaseDate: tmdbData.releaseDate,
          runtime: tmdbData.runtime,
          genres: tmdbData.genres,
          tmdbRating: tmdbData.tmdbRating,
          tmdbVoteCount: tmdbData.tmdbVoteCount,
          tmdbPopularity: tmdbData.tmdbPopularity,
          imdbId: tmdbData.imdbId || movie.imdbId,
          imdbRating: tmdbData.imdbRating || movie.imdbRating,
          rottenTomatoesRating: tmdbData.rottenTomatoesRating || movie.rottenTomatoesRating,
          metacriticRating: tmdbData.metacriticRating || movie.metacriticRating,
        });
      }
    }

    // Fetch Kinopoisk data if we have kinopoiskId
    if (movie.kinopoiskId && !movie.kinopoiskRating) {
      const kpData = await this.fetchFromKinopoisk(movie.kinopoiskId);
      if (kpData) {
        updates.kinopoiskRating = kpData.kinopoiskRating;
        updates.titleRu = updates.titleRu || kpData.titleRu;
        updates.overviewRu = updates.overviewRu || kpData.overviewRu;
        updates.posterUrl = kpData.posterUrl;
      }
    }

    // Fetch OMDB data if we have imdbId
    if (movie.imdbId && !movie.rottenTomatoesRating) {
      const omdbData = await omdb.getByImdbId(movie.imdbId);
      if (omdbData) {
        updates.imdbRating = updates.imdbRating || omdbData.imdbRating;
        updates.rottenTomatoesRating = OMDBClient.getRottenTomatoesRating(omdbData.Ratings);
        updates.metacriticRating = OMDBClient.getMetacriticRating(omdbData.Ratings);
      }
    }

    // Update cache timestamp
    updates.cachedAt = new Date();

    await db.update(movies).set(updates).where(eq(movies.id, movieId));

    return this.findById(movieId);
  }

  /**
   * Link external IDs to an existing movie
   */
  async linkExternalIds(movieId: string, ids: ExternalIds): Promise<void> {
    const updates: Partial<NewMovie> = {};

    if (ids.tmdbId) updates.tmdbId = ids.tmdbId;
    if (ids.imdbId) updates.imdbId = ids.imdbId;
    if (ids.kinopoiskId) updates.kinopoiskId = ids.kinopoiskId;

    if (Object.keys(updates).length > 0) {
      await db.update(movies).set(updates).where(eq(movies.id, movieId));
    }
  }

  /**
   * Convert SearchResult to movie, creating if needed
   */
  async fromSearchResult(result: SearchResult): Promise<Movie | null> {
    return this.findOrCreate({
      tmdbId: result.tmdbId,
      imdbId: result.imdbId,
      kinopoiskId: result.kinopoiskId,
      title: result.title,
      titleRu: result.titleRu || undefined,
      source: result.source,
    });
  }

  /**
   * Convert KinopoiskSearchResult to movie, creating if needed
   */
  async fromKinopoiskResult(result: KinopoiskSearchResult): Promise<Movie | null> {
    return this.findOrCreate({
      kinopoiskId: result.kinopoiskId,
      imdbId: result.imdbId,
      title: result.nameOriginal || result.nameEn || result.nameRu || 'Unknown',
      titleRu: result.nameRu || undefined,
      source: 'kinopoisk',
    });
  }

  /**
   * Get poster URL for a movie
   * Priority: local compressed poster > TMDB > Kinopoisk > fallback
   */
  getPosterUrl(movie: Movie, size: 'w185' | 'w342' | 'w500' | 'original' = 'w500'): string {
    // Prefer local compressed poster
    if (movie.localPosterPath) {
      return movie.localPosterPath;
    }
    // Fall back to TMDB poster path
    if (movie.posterPath) {
      return TMDBClient.getPosterUrl(movie.posterPath, size);
    }
    // Fall back to direct URL (Kinopoisk)
    if (movie.posterUrl) {
      return movie.posterUrl;
    }
    return '/images/no-poster.svg';
  }

  /**
   * Get backdrop URL for a movie
   */
  getBackdropUrl(movie: Movie, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
    if (movie.backdropPath) {
      return TMDBClient.getBackdropUrl(movie.backdropPath, size);
    }
    return '/images/no-backdrop.png';
  }
}

export const movieService = new MovieService();
export { MovieService };
