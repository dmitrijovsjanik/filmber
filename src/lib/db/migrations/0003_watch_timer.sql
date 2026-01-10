-- Add watch_started_at field to user_movie_lists for tracking "watch timer"
ALTER TABLE "user_movie_lists" ADD COLUMN "watch_started_at" timestamp;
