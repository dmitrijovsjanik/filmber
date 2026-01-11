-- Migration: Queue Algorithm for improved movie matching
-- Run this manually: psql $DATABASE_URL -f src/lib/db/migrations/queue_algorithm.sql

-- 1. Add user ID fields to rooms table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS user_a_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS user_b_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Create room_queues table
CREATE TABLE IF NOT EXISTS room_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_slot VARCHAR(1) NOT NULL, -- 'A' or 'B'

  base_pool_direction VARCHAR(4) NOT NULL, -- 'asc' or 'desc'
  current_base_index INTEGER NOT NULL,

  priority_queue TEXT NOT NULL DEFAULT '[]', -- JSON array of tmdbIds
  priority_queue_index INTEGER NOT NULL DEFAULT 0,

  excluded_ids TEXT NOT NULL DEFAULT '[]', -- JSON array

  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Unique index for room + user slot
CREATE UNIQUE INDEX IF NOT EXISTS unique_room_queue_idx ON room_queues(room_id, user_slot);

-- 3. Create deck_settings table
CREATE TABLE IF NOT EXISTS deck_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  show_watched_movies BOOLEAN DEFAULT FALSE,
  min_rating_filter INTEGER, -- null = no filter, 1-3

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Done!
SELECT 'Migration completed successfully!' as status;
