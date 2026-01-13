-- Migration: Populate unifiedMovieId fields and prepare for legacy field removal
-- This migration links all tmdbId references to the unified movies.id

-- Step 1: Populate unified_movie_id in user_movie_lists
UPDATE user_movie_lists uml
SET unified_movie_id = m.id
FROM movies m
WHERE uml.tmdb_id = m.tmdb_id
  AND uml.unified_movie_id IS NULL;

-- Step 2: Populate unified_movie_id in user_swipe_history
UPDATE user_swipe_history ush
SET unified_movie_id = m.id
FROM movies m
WHERE ush.tmdb_id = m.tmdb_id
  AND ush.unified_movie_id IS NULL;

-- Step 3: Populate unified_movie_id in watch_prompts
UPDATE watch_prompts wp
SET unified_movie_id = m.id
FROM movies m
WHERE wp.tmdb_id = m.tmdb_id
  AND wp.unified_movie_id IS NULL;

-- Step 4: Populate unified_movie_id in swipes
UPDATE swipes s
SET unified_movie_id = m.id
FROM movies m
WHERE s.movie_id = m.tmdb_id
  AND s.unified_movie_id IS NULL;

-- Step 5: Populate unified_matched_movie_id in rooms
UPDATE rooms r
SET unified_matched_movie_id = m.id
FROM movies m
WHERE r.matched_movie_id = m.tmdb_id
  AND r.unified_matched_movie_id IS NULL;

-- Log results
DO $$
DECLARE
  uml_count INTEGER;
  ush_count INTEGER;
  wp_count INTEGER;
  swipes_count INTEGER;
  rooms_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO uml_count FROM user_movie_lists WHERE unified_movie_id IS NOT NULL;
  SELECT COUNT(*) INTO ush_count FROM user_swipe_history WHERE unified_movie_id IS NOT NULL;
  SELECT COUNT(*) INTO wp_count FROM watch_prompts WHERE unified_movie_id IS NOT NULL;
  SELECT COUNT(*) INTO swipes_count FROM swipes WHERE unified_movie_id IS NOT NULL;
  SELECT COUNT(*) INTO rooms_count FROM rooms WHERE unified_matched_movie_id IS NOT NULL;

  RAISE NOTICE 'Unified IDs populated: user_movie_lists=%, user_swipe_history=%, watch_prompts=%, swipes=%, rooms=%',
    uml_count, ush_count, wp_count, swipes_count, rooms_count;
END $$;
