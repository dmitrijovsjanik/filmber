-- Migration: Drop deprecated movie_cache table
-- All data has been migrated to the unified 'movies' table

DROP TABLE IF EXISTS "movie_cache";
