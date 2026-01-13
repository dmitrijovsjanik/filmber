-- Migration: Migrate data from movie_cache to movies, then drop movie_cache table
-- Safe migration: handles case when movie_cache doesn't exist

DO $$
BEGIN
  -- Check if movie_cache table exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'movie_cache'
  ) THEN
    -- Migrate data from movie_cache to movies
    INSERT INTO "movies" (
      "tmdb_id",
      "title",
      "title_ru",
      "overview",
      "overview_ru",
      "poster_path",
      "backdrop_path",
      "release_date",
      "tmdb_rating",
      "tmdb_vote_count",
      "tmdb_popularity",
      "imdb_id",
      "imdb_rating",
      "rt_rating",
      "metacritic_rating",
      "genres",
      "runtime",
      "media_type",
      "primary_source",
      "cached_at",
      "updated_at"
    )
    SELECT
      mc."tmdb_id",
      mc."title",
      mc."title_ru",
      mc."overview",
      mc."overview_ru",
      mc."poster_path",
      mc."backdrop_path",
      mc."release_date",
      mc."vote_average",
      mc."vote_count",
      mc."popularity",
      NULLIF(mc."imdb_id", ''),
      NULLIF(mc."imdb_rating", ''),
      NULLIF(mc."rt_rating", ''),
      NULLIF(mc."metacritic_rating", ''),
      mc."genres",
      mc."runtime",
      'movie',
      'tmdb',
      mc."cached_at",
      mc."cached_at"
    FROM "movie_cache" mc
    WHERE NOT EXISTS (
      SELECT 1 FROM "movies" m WHERE m."tmdb_id" = mc."tmdb_id"
    );

    -- Drop the movie_cache table
    DROP TABLE "movie_cache";

    RAISE NOTICE 'movie_cache table migrated and dropped';
  ELSE
    RAISE NOTICE 'movie_cache table does not exist, skipping migration';
  END IF;
END $$;
