import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  uniqueIndex,
  index,
  bigint,
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

// ============================================
// USERS - Telegram authenticated users
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Telegram data
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  telegramUsername: varchar('telegram_username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }),
  photoUrl: varchar('photo_url', { length: 500 }),
  languageCode: varchar('language_code', { length: 10 }),

  // App settings
  isPremium: boolean('is_premium').default(false),
  lastSeenAt: timestamp('last_seen_at'),

  // Referral system
  referralCode: varchar('referral_code', { length: 12 }).unique(),
  referredById: uuid('referred_by_id'),
  referredAt: timestamp('referred_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// REFERRAL_REWARDS - Track referral bonuses (for future use)
// ============================================
export const referralRewards = pgTable(
  'referral_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Reward details
    rewardType: varchar('reward_type', { length: 50 }).notNull(), // 'milestone_5' | 'milestone_10' | etc.
    referralCount: integer('referral_count').notNull(),
    rewardValue: text('reward_value'), // JSON with reward data

    // Status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'claimed' | 'expired'
    claimedAt: timestamp('claimed_at'),
    expiresAt: timestamp('expires_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reward_user_idx').on(table.userId),
    index('reward_status_idx').on(table.status),
  ]
);

// ============================================
// USER_MOVIE_LISTS - Movies saved by users
// ============================================
export const userMovieLists = pgTable(
  'user_movie_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tmdbId: integer('tmdb_id').notNull(),

    // Level 1: Watch status
    status: varchar('status', { length: 20 }).notNull(), // 'want_to_watch' | 'watched'

    // Level 2: Rating (1-3 stars, null if not rated)
    rating: integer('rating'), // 1, 2, or 3

    // Source of addition
    source: varchar('source', { length: 20 }).notNull(), // 'swipe' | 'manual' | 'import'

    // Optional notes
    notes: text('notes'),

    // When they watched it (for 'watched' status)
    watchedAt: timestamp('watched_at'),

    // When the "watch timer" started (for swipe-added movies)
    watchStartedAt: timestamp('watch_started_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_user_movie_idx').on(table.userId, table.tmdbId),
    index('user_movie_status_idx').on(table.userId, table.status),
    index('user_movie_rating_idx').on(table.userId, table.rating),
  ]
);

// ============================================
// USER_SWIPE_HISTORY - Persistent swipe history for auth users
// ============================================
export const userSwipeHistory = pgTable(
  'user_swipe_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    action: varchar('action', { length: 10 }).notNull(), // 'like' | 'skip'

    // Context (where did the swipe happen)
    context: varchar('context', { length: 20 }), // 'solo' | 'room' | null
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_user_swipe_idx').on(table.userId, table.tmdbId),
    index('user_swipe_action_idx').on(table.userId, table.action),
  ]
);

// ============================================
// USER_SESSIONS - JWT session management
// ============================================
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Session token (hashed)
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),

    // Device/client info
    deviceInfo: text('device_info'), // JSON: userAgent, platform, etc.

    // Expiration
    expiresAt: timestamp('expires_at').notNull(),
    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('session_user_idx').on(table.userId),
    index('session_expires_idx').on(table.expiresAt),
  ]
);

// ============================================
// WATCH_PROMPTS - Track "Did you watch?" prompts
// ============================================
export const watchPrompts = pgTable(
  'watch_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tmdbId: integer('tmdb_id').notNull(),

    // Prompt status
    promptedAt: timestamp('prompted_at').defaultNow().notNull(),
    respondedAt: timestamp('responded_at'),
    response: varchar('response', { length: 20 }), // 'watched' | 'not_yet' | 'dismissed'

    // Don't prompt again until
    snoozeUntil: timestamp('snooze_until'),
  },
  (table) => [
    uniqueIndex('unique_prompt_idx').on(table.userId, table.tmdbId),
    index('prompt_user_pending_idx').on(table.userId, table.respondedAt),
  ]
);

// ============================================
// NOTIFICATION_SETTINGS - User notification preferences
// ============================================
export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // Bot message settings
  watchReminders: boolean('watch_reminders').default(true), // Напоминания о просмотре

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// RELATIONS - Users
// ============================================
export const usersRelations = relations(users, ({ many, one }) => ({
  movieLists: many(userMovieLists),
  swipeHistory: many(userSwipeHistory),
  sessions: many(userSessions),
  watchPrompts: many(watchPrompts),
  notificationSettings: one(notificationSettings),
  // Referral relations
  referredBy: one(users, {
    fields: [users.referredById],
    references: [users.id],
    relationName: 'referrer',
  }),
  referrals: many(users, { relationName: 'referrer' }),
  referralRewards: many(referralRewards),
}));

export const userMovieListsRelations = relations(userMovieLists, ({ one }) => ({
  user: one(users, {
    fields: [userMovieLists.userId],
    references: [users.id],
  }),
}));

export const userSwipeHistoryRelations = relations(userSwipeHistory, ({ one }) => ({
  user: one(users, {
    fields: [userSwipeHistory.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [userSwipeHistory.roomId],
    references: [rooms.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const watchPromptsRelations = relations(watchPrompts, ({ one }) => ({
  user: one(users, {
    fields: [watchPrompts.userId],
    references: [users.id],
  }),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id],
  }),
}));

export const referralRewardsRelations = relations(referralRewards, ({ one }) => ({
  user: one(users, {
    fields: [referralRewards.userId],
    references: [users.id],
  }),
}));

// ============================================
// ENUMS/CONSTANTS
// ============================================
export const MOVIE_STATUS = {
  WATCHING: 'watching', // Фильм с активным таймером - отображается во всех списках
  WANT_TO_WATCH: 'want_to_watch',
  WATCHED: 'watched',
} as const;

export const MOVIE_SOURCE = {
  SWIPE: 'swipe',
  MANUAL: 'manual',
  IMPORT: 'import',
} as const;

export type MovieStatus = (typeof MOVIE_STATUS)[keyof typeof MOVIE_STATUS];
export type MovieSource = (typeof MOVIE_SOURCE)[keyof typeof MOVIE_SOURCE];

// ============================================
// TYPE EXPORTS
// ============================================

// Existing types
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Swipe = typeof swipes.$inferSelect;
export type NewSwipe = typeof swipes.$inferInsert;
export type MovieCacheEntry = typeof movieCache.$inferSelect;
export type NewMovieCacheEntry = typeof movieCache.$inferInsert;

// New types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserMovieList = typeof userMovieLists.$inferSelect;
export type NewUserMovieList = typeof userMovieLists.$inferInsert;
export type UserSwipeHistory = typeof userSwipeHistory.$inferSelect;
export type NewUserSwipeHistory = typeof userSwipeHistory.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type WatchPrompt = typeof watchPrompts.$inferSelect;
export type NewWatchPrompt = typeof watchPrompts.$inferInsert;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type NewNotificationSettings = typeof notificationSettings.$inferInsert;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type NewReferralReward = typeof referralRewards.$inferInsert;
