import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Rooms table - temporary sessions for 2 users
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  pin: varchar('pin', { length: 6 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('waiting'),
  // Status: 'waiting' | 'active' | 'matched' | 'expired'
  userAConnected: boolean('user_a_connected').default(false),
  userBConnected: boolean('user_b_connected').default(false),
  matchedMovieId: integer('matched_movie_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  moviePoolSeed: integer('movie_pool_seed').notNull(),
});

// Swipes table - tracks user swipe actions
export const swipes = pgTable(
  'swipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    movieId: integer('movie_id').notNull(),
    userSlot: varchar('user_slot', { length: 1 }).notNull(), // 'A' or 'B'
    action: varchar('action', { length: 10 }).notNull(), // 'like' | 'skip'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_swipe_idx').on(table.roomId, table.movieId, table.userSlot),
  ]
);

// Movie cache - cache TMDB/OMDB data
export const movieCache = pgTable('movie_cache', {
  tmdbId: integer('tmdb_id').primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  titleRu: varchar('title_ru', { length: 500 }),
  overview: text('overview'),
  overviewRu: text('overview_ru'),
  posterPath: varchar('poster_path', { length: 500 }),
  backdropPath: varchar('backdrop_path', { length: 500 }),
  releaseDate: varchar('release_date', { length: 20 }),
  voteAverage: varchar('vote_average', { length: 10 }),
  imdbId: varchar('imdb_id', { length: 20 }),
  imdbRating: varchar('imdb_rating', { length: 10 }),
  rottenTomatoesRating: varchar('rt_rating', { length: 10 }),
  metacriticRating: varchar('metacritic_rating', { length: 10 }),
  genres: text('genres'), // JSON array
  runtime: integer('runtime'),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
});

// Relations
export const roomsRelations = relations(rooms, ({ many }) => ({
  swipes: many(swipes),
}));

export const swipesRelations = relations(swipes, ({ one }) => ({
  room: one(rooms, {
    fields: [swipes.roomId],
    references: [rooms.id],
  }),
}));

// Type exports
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Swipe = typeof swipes.$inferSelect;
export type NewSwipe = typeof swipes.$inferInsert;
export type MovieCacheEntry = typeof movieCache.$inferSelect;
export type NewMovieCacheEntry = typeof movieCache.$inferInsert;
