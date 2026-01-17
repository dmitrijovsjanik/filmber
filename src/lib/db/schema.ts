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
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 10 }).notNull().unique(),
    pin: varchar('pin', { length: 6 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('waiting'),
    // Status: 'waiting' | 'active' | 'matched' | 'expired'
    userAConnected: boolean('user_a_connected').default(false),
    userBConnected: boolean('user_b_connected').default(false),
    // Associate authenticated users with slots (for personalized queue)
    userAId: uuid('user_a_id').references(() => users.id, { onDelete: 'set null' }),
    userBId: uuid('user_b_id').references(() => users.id, { onDelete: 'set null' }),

    // Legacy TMDB ID for match (kept for backward compatibility)
    matchedMovieId: integer('matched_movie_id'),

    // New unified movie reference (for future use)
    unifiedMatchedMovieId: uuid('unified_matched_movie_id').references(() => movies.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    moviePoolSeed: integer('movie_pool_seed').notNull(),
  },
  (table) => [
    index('rooms_expires_idx').on(table.expiresAt),
    index('rooms_status_idx').on(table.status),
  ]
);

// Swipes table - tracks user swipe actions
export const swipes = pgTable(
  'swipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),

    // Legacy TMDB ID field (kept for backward compatibility)
    movieId: integer('movie_id').notNull(),

    // New unified movie reference (for future use)
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'cascade' }),

    userSlot: varchar('user_slot', { length: 1 }).notNull(), // 'A' or 'B'
    action: varchar('action', { length: 10 }).notNull(), // 'like' | 'skip'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_swipe_idx').on(table.roomId, table.movieId, table.userSlot),
    index('swipe_unified_idx').on(table.roomId, table.unifiedMovieId, table.userSlot),
  ]
);

// ============================================
// MOVIES - Unified movie database
// ============================================
export const movies = pgTable(
  'movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // External IDs (all nullable - movie may come from any source)
    tmdbId: integer('tmdb_id').unique(),
    imdbId: varchar('imdb_id', { length: 20 }).unique(),
    kinopoiskId: integer('kinopoisk_id').unique(),

    // Core data
    title: varchar('title', { length: 500 }).notNull(),
    titleRu: varchar('title_ru', { length: 500 }),
    titleOriginal: varchar('title_original', { length: 500 }),
    overview: text('overview'),
    overviewRu: text('overview_ru'),

    // Media
    posterPath: varchar('poster_path', { length: 500 }), // TMDB path
    posterUrl: varchar('poster_url', { length: 500 }), // Direct URL (Kinopoisk)
    localPosterPath: varchar('local_poster_path', { length: 200 }), // Local compressed poster
    backdropPath: varchar('backdrop_path', { length: 500 }),

    // Metadata
    releaseDate: varchar('release_date', { length: 20 }),
    runtime: integer('runtime'),
    genres: text('genres'), // JSON array

    // Media type (movie or TV series)
    mediaType: varchar('media_type', { length: 20 }).notNull().default('movie'), // 'movie' | 'tv'
    numberOfSeasons: integer('number_of_seasons'),
    numberOfEpisodes: integer('number_of_episodes'),
    originalLanguage: varchar('original_language', { length: 10 }), // ISO 639-1 code (e.g., 'en', 'ru')

    // Ratings from all sources
    tmdbRating: varchar('tmdb_rating', { length: 10 }),
    tmdbVoteCount: integer('tmdb_vote_count'),
    tmdbPopularity: varchar('tmdb_popularity', { length: 20 }),
    imdbRating: varchar('imdb_rating', { length: 10 }),
    kinopoiskRating: varchar('kinopoisk_rating', { length: 10 }),
    rottenTomatoesRating: varchar('rt_rating', { length: 10 }),
    metacriticRating: varchar('metacritic_rating', { length: 10 }),

    // Tracking
    primarySource: varchar('primary_source', { length: 20 }).notNull(), // 'tmdb' | 'kinopoisk' | 'omdb'
    cachedAt: timestamp('cached_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('movies_tmdb_idx').on(table.tmdbId),
    index('movies_imdb_idx').on(table.imdbId),
    index('movies_kinopoisk_idx').on(table.kinopoiskId),
    index('movies_media_type_idx').on(table.mediaType),
    index('movies_cached_idx').on(table.cachedAt),
    index('movies_release_idx').on(table.releaseDate),
  ]
);

// ============================================
// RELATIONS
// ============================================

// Movies relations
export const moviesRelations = relations(movies, ({ many }) => ({
  userLists: many(userMovieLists),
  swipeHistory: many(userSwipeHistory),
  swipes: many(swipes),
  watchPrompts: many(watchPrompts),
}));

// Rooms relations
export const roomsRelations = relations(rooms, ({ many, one }) => ({
  swipes: many(swipes),
  queues: many(roomQueues),
  userA: one(users, {
    fields: [rooms.userAId],
    references: [users.id],
    relationName: 'roomUserA',
  }),
  userB: one(users, {
    fields: [rooms.userBId],
    references: [users.id],
    relationName: 'roomUserB',
  }),
  unifiedMatchedMovie: one(movies, {
    fields: [rooms.unifiedMatchedMovieId],
    references: [movies.id],
  }),
}));

export const swipesRelations = relations(swipes, ({ one }) => ({
  room: one(rooms, {
    fields: [swipes.roomId],
    references: [rooms.id],
  }),
  unifiedMovie: one(movies, {
    fields: [swipes.unifiedMovieId],
    references: [movies.id],
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

    // Legacy TMDB ID (kept for backward compatibility)
    tmdbId: integer('tmdb_id').notNull(),

    // New unified movie reference (for future use)
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'cascade' }),

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
    index('user_movie_unified_idx').on(table.userId, table.unifiedMovieId),
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

    // Legacy TMDB ID (kept for backward compatibility)
    tmdbId: integer('tmdb_id').notNull(),

    // New unified movie reference (for future use)
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'cascade' }),

    action: varchar('action', { length: 10 }).notNull(), // 'like' | 'skip'

    // Context (where did the swipe happen)
    context: varchar('context', { length: 20 }), // 'solo' | 'room' | null
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unique_user_swipe_idx').on(table.userId, table.tmdbId),
    index('user_swipe_action_idx').on(table.userId, table.action),
    index('user_swipe_unified_idx').on(table.userId, table.unifiedMovieId),
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

    // Legacy TMDB ID (kept for backward compatibility)
    tmdbId: integer('tmdb_id').notNull(),

    // New unified movie reference (for future use)
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'cascade' }),

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
    index('prompt_unified_idx').on(table.userId, table.unifiedMovieId),
    index('prompt_snooze_idx').on(table.snoozeUntil),
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

  // Upcoming movies notifications
  upcomingAnnouncements: boolean('upcoming_announcements').default(true), // Анонсы новых фильмов
  upcomingTheatricalReleases: boolean('upcoming_theatrical_releases').default(true), // Премьеры в кино
  upcomingDigitalReleases: boolean('upcoming_digital_releases').default(true), // Цифровые релизы

  // App updates / release notes notifications
  appUpdates: boolean('app_updates').default(true), // Уведомления о новых версиях приложения

  // TV Series notifications
  seriesSeasonAnnouncements: boolean('series_season_announcements').default(true), // Уведомления о новых сезонах
  seriesEpisodeReleases: boolean('series_episode_releases').default(true), // Уведомления о новых сериях

  // Preferred release region for notifications
  preferredReleaseRegion: varchar('preferred_release_region', { length: 5 }).default('US'), // 'US' | 'RU'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// ROOM_QUEUES - Per-user queue state for rooms
// ============================================
export const roomQueues = pgTable(
  'room_queues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .references(() => rooms.id, { onDelete: 'cascade' })
      .notNull(),
    userSlot: varchar('user_slot', { length: 1 }).notNull(), // 'A' | 'B'

    // Base pool traversal direction
    basePoolDirection: varchar('base_pool_direction', { length: 4 }).notNull(), // 'asc' | 'desc'
    currentBaseIndex: integer('current_base_index').notNull(),

    // Priority queue (JSON array of tmdbIds)
    priorityQueue: text('priority_queue').notNull().default('[]'),
    priorityQueueIndex: integer('priority_queue_index').notNull().default(0),

    // Excluded movie IDs (JSON array)
    excludedIds: text('excluded_ids').notNull().default('[]'),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('unique_room_queue_idx').on(table.roomId, table.userSlot)]
);

// ============================================
// DECK_SETTINGS - User deck configuration
// ============================================
export const deckSettings = pgTable('deck_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // Settings
  showWatchedMovies: boolean('show_watched_movies').default(false),
  minRatingFilter: integer('min_rating_filter'), // null = no filter, 1-3
  mediaTypeFilter: varchar('media_type_filter', { length: 20 }).default('all'), // 'all' | 'movie' | 'tv'

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
  deckSettings: one(deckSettings),
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
  unifiedMovie: one(movies, {
    fields: [userMovieLists.unifiedMovieId],
    references: [movies.id],
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
  unifiedMovie: one(movies, {
    fields: [userSwipeHistory.unifiedMovieId],
    references: [movies.id],
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
  unifiedMovie: one(movies, {
    fields: [watchPrompts.unifiedMovieId],
    references: [movies.id],
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

export const roomQueuesRelations = relations(roomQueues, ({ one }) => ({
  room: one(rooms, {
    fields: [roomQueues.roomId],
    references: [rooms.id],
  }),
}));

export const deckSettingsRelations = relations(deckSettings, ({ one }) => ({
  user: one(users, {
    fields: [deckSettings.userId],
    references: [users.id],
  }),
}));

// ============================================
// BUG_REPORTS - User bug reports via Telegram bot
// ============================================
export const bugReports = pgTable(
  'bug_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    telegramUsername: varchar('telegram_username', { length: 255 }),
    firstName: varchar('first_name', { length: 255 }),

    // Report content
    message: text('message').notNull(),

    // Status
    status: varchar('status', { length: 20 }).notNull().default('open'), // 'open' | 'replied' | 'closed'

    // Admin response
    adminReply: text('admin_reply'),
    repliedAt: timestamp('replied_at'),
    repliedBy: uuid('replied_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('bug_report_status_idx').on(table.status),
    index('bug_report_user_idx').on(table.userId),
  ]
);

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(users, {
    fields: [bugReports.userId],
    references: [users.id],
  }),
  repliedByUser: one(users, {
    fields: [bugReports.repliedBy],
    references: [users.id],
  }),
}));

// ============================================
// UPCOMING_MOVIES - Track upcoming movie releases
// ============================================
export const upcomingMovies = pgTable(
  'upcoming_movies',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // External IDs
    tmdbId: integer('tmdb_id').notNull().unique(),
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'set null' }),

    // Release dates (YYYY-MM-DD format)
    theatricalReleaseUs: varchar('theatrical_release_us', { length: 20 }),
    theatricalReleaseRu: varchar('theatrical_release_ru', { length: 20 }),
    digitalRelease: varchar('digital_release', { length: 20 }),

    // Metadata for filtering and display
    popularity: varchar('popularity', { length: 20 }),
    title: varchar('title', { length: 500 }).notNull(),
    titleRu: varchar('title_ru', { length: 500 }),
    posterPath: varchar('poster_path', { length: 500 }),
    overview: text('overview'),
    overviewRu: text('overview_ru'),
    genres: text('genres'), // JSON array

    // Notification tracking - when each type was sent
    announcementSentAt: timestamp('announcement_sent_at'),
    theatricalReleaseSentAt: timestamp('theatrical_release_sent_at'),
    digitalReleaseSentAt: timestamp('digital_release_sent_at'),

    // Status tracking
    status: varchar('status', { length: 20 }).notNull().default('tracked'), // 'tracked' | 'released' | 'archived'

    // Timestamps
    discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('upcoming_tmdb_idx').on(table.tmdbId),
    index('upcoming_theatrical_us_idx').on(table.theatricalReleaseUs),
    index('upcoming_theatrical_ru_idx').on(table.theatricalReleaseRu),
    index('upcoming_digital_idx').on(table.digitalRelease),
    index('upcoming_status_idx').on(table.status),
    index('upcoming_popularity_idx').on(table.popularity),
  ]
);

// ============================================
// NOTIFICATION_CONFIG - Admin-configurable notification settings
// ============================================
export const notificationConfig = pgTable('notification_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(), // JSON string
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

// ============================================
// NOTIFICATION_LOG - Track sent notifications for analytics
// ============================================
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Notification details
    type: varchar('type', { length: 30 }).notNull(), // 'announcement' | 'theatrical_release' | 'digital_release' | 'season_announcement' | 'episode_release'
    upcomingMovieId: uuid('upcoming_movie_id').references(() => upcomingMovies.id, { onDelete: 'set null' }),
    tmdbId: integer('tmdb_id'),

    // TV Series specific fields
    trackedSeriesId: uuid('tracked_series_id'), // Will be set after trackedSeries table exists
    seasonNumber: integer('season_number'),
    episodeNumber: integer('episode_number'),

    // Stats
    totalRecipients: integer('total_recipients').notNull(),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),

    // Timing
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),

    // Debug info
    errorDetails: text('error_details'), // JSON array of errors
  },
  (table) => [
    index('notification_log_type_idx').on(table.type),
    index('notification_log_movie_idx').on(table.upcomingMovieId),
    index('notification_log_started_idx').on(table.startedAt),
    index('notification_log_series_idx').on(table.trackedSeriesId),
  ]
);

// ============================================
// UPCOMING_SYNC_STATS - Daily statistics for sync and announcements
// ============================================
export const upcomingSyncStats = pgTable(
  'upcoming_sync_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Date for grouping (one record per day)
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD format

    // Sync stats
    syncNewMovies: integer('sync_new_movies').notNull().default(0),
    syncUpdatedMovies: integer('sync_updated_movies').notNull().default(0),
    syncArchivedMovies: integer('sync_archived_movies').notNull().default(0),

    // Announcement stats
    announcedMovies: integer('announced_movies').notNull().default(0),
    skippedLowPopularity: integer('skipped_low_popularity').notNull().default(0),
    skippedNoRussian: integer('skipped_no_russian').notNull().default(0),
    skippedNoPoster: integer('skipped_no_poster').notNull().default(0),
    skippedTooYoung: integer('skipped_too_young').notNull().default(0),

    // Notification delivery stats
    notificationsSent: integer('notifications_sent').notNull().default(0),
    notificationsFailed: integer('notifications_failed').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('upcoming_sync_stats_date_idx').on(table.date)]
);

// Relations for upcoming movies tables
export const upcomingMoviesRelations = relations(upcomingMovies, ({ one, many }) => ({
  unifiedMovie: one(movies, {
    fields: [upcomingMovies.unifiedMovieId],
    references: [movies.id],
  }),
  notificationLogs: many(notificationLog),
}));

// ============================================
// TRACKED_SERIES - Track TV series for notifications
// ============================================
export const trackedSeries = pgTable(
  'tracked_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tmdbId: integer('tmdb_id').notNull().unique(),
    unifiedMovieId: uuid('unified_movie_id').references(() => movies.id, { onDelete: 'set null' }),

    // Cached data
    title: varchar('title', { length: 500 }).notNull(),
    titleRu: varchar('title_ru', { length: 500 }),
    posterPath: varchar('poster_path', { length: 500 }),

    // Season tracking
    lastKnownSeasons: integer('last_known_seasons').notNull(),
    currentSeasons: integer('current_seasons').notNull(),
    seriesStatus: varchar('series_status', { length: 30 }), // 'Returning Series' | 'Ended' | 'Canceled'

    // Notifications
    newSeasonDetectedAt: timestamp('new_season_detected_at'),
    seasonAnnouncementSentAt: timestamp('season_announcement_sent_at'),

    // Tracking status
    trackingStatus: varchar('tracking_status', { length: 20 }).notNull().default('active'), // 'active' | 'ended' | 'archived'

    discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('tracked_series_tmdb_idx').on(table.tmdbId),
    index('tracked_series_status_idx').on(table.trackingStatus),
    index('tracked_series_new_season_idx').on(table.newSeasonDetectedAt),
  ]
);

// ============================================
// TRACKED_EPISODES - Track episodes for notifications
// ============================================
export const trackedEpisodes = pgTable(
  'tracked_episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackedSeriesId: uuid('tracked_series_id')
      .references(() => trackedSeries.id, { onDelete: 'cascade' })
      .notNull(),
    tmdbId: integer('tmdb_id').notNull(),

    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    episodeName: varchar('episode_name', { length: 500 }),

    airDate: varchar('air_date', { length: 20 }), // YYYY-MM-DD
    notifyDate: varchar('notify_date', { length: 20 }), // airDate + delay days

    notificationSentAt: timestamp('notification_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('tracked_episodes_series_idx').on(table.trackedSeriesId),
    index('tracked_episodes_notify_idx').on(table.notifyDate),
    uniqueIndex('tracked_episodes_unique_idx').on(table.trackedSeriesId, table.seasonNumber, table.episodeNumber),
  ]
);

// Relations for tracked series
export const trackedSeriesRelations = relations(trackedSeries, ({ one, many }) => ({
  unifiedMovie: one(movies, {
    fields: [trackedSeries.unifiedMovieId],
    references: [movies.id],
  }),
  episodes: many(trackedEpisodes),
}));

export const trackedEpisodesRelations = relations(trackedEpisodes, ({ one }) => ({
  series: one(trackedSeries, {
    fields: [trackedEpisodes.trackedSeriesId],
    references: [trackedSeries.id],
  }),
}));

export const notificationConfigRelations = relations(notificationConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [notificationConfig.updatedBy],
    references: [users.id],
  }),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  upcomingMovie: one(upcomingMovies, {
    fields: [notificationLog.upcomingMovieId],
    references: [upcomingMovies.id],
  }),
}));

// ============================================
// SCHEDULED_NOTIFICATIONS - Queue for distributed notifications
// ============================================
export const scheduledNotifications = pgTable(
  'scheduled_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Content reference
    type: varchar('type', { length: 30 }).notNull(), // 'announcement' | 'theatrical_release' | 'digital_release' | 'season_announcement' | 'episode_release'
    upcomingMovieId: uuid('upcoming_movie_id').references(() => upcomingMovies.id, { onDelete: 'cascade' }),
    trackedSeriesId: uuid('tracked_series_id').references(() => trackedSeries.id, { onDelete: 'cascade' }),
    trackedEpisodeId: uuid('tracked_episode_id').references(() => trackedEpisodes.id, { onDelete: 'cascade' }),
    tmdbId: integer('tmdb_id').notNull(),

    // Scheduling
    period: varchar('period', { length: 10 }).notNull(), // 'day' (06:00-18:00 MSK) | 'evening' (18:00-06:00 MSK)
    scheduledDate: varchar('scheduled_date', { length: 10 }).notNull(), // YYYY-MM-DD
    scheduledHour: integer('scheduled_hour').notNull(), // 0-23 UTC hour
    scheduledMinute: integer('scheduled_minute').notNull().default(0), // 0 or 30

    // Priority for ordering within same slot (lower = higher priority)
    priority: integer('priority').notNull().default(100),

    // Status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'sending' | 'sent' | 'failed'
    sentAt: timestamp('sent_at'),
    successCount: integer('success_count'),
    failureCount: integer('failure_count'),
    errorDetails: text('error_details'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('scheduled_notifications_date_hour_idx').on(table.scheduledDate, table.scheduledHour, table.scheduledMinute),
    index('scheduled_notifications_status_idx').on(table.status),
    index('scheduled_notifications_type_idx').on(table.type),
    index('scheduled_notifications_tmdb_idx').on(table.tmdbId),
    // Unique constraint to prevent duplicate scheduling
    uniqueIndex('scheduled_notifications_unique_idx').on(table.type, table.tmdbId, table.scheduledDate),
  ]
);

export const scheduledNotificationsRelations = relations(scheduledNotifications, ({ one }) => ({
  upcomingMovie: one(upcomingMovies, {
    fields: [scheduledNotifications.upcomingMovieId],
    references: [upcomingMovies.id],
  }),
  trackedSeries: one(trackedSeries, {
    fields: [scheduledNotifications.trackedSeriesId],
    references: [trackedSeries.id],
  }),
  trackedEpisode: one(trackedEpisodes, {
    fields: [scheduledNotifications.trackedEpisodeId],
    references: [trackedEpisodes.id],
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

export const MEDIA_TYPE = {
  MOVIE: 'movie',
  TV: 'tv',
} as const;

export const MEDIA_TYPE_FILTER = {
  ALL: 'all',
  MOVIE: 'movie',
  TV: 'tv',
} as const;

export const NOTIFICATION_TYPE = {
  // Movie notifications
  ANNOUNCEMENT: 'announcement',
  THEATRICAL_RELEASE: 'theatrical_release',
  DIGITAL_RELEASE: 'digital_release',
  // TV Series notifications
  SEASON_ANNOUNCEMENT: 'season_announcement',
  EPISODE_RELEASE: 'episode_release',
} as const;

export const UPCOMING_MOVIE_STATUS = {
  TRACKED: 'tracked',
  RELEASED: 'released',
  ARCHIVED: 'archived',
} as const;

export const RELEASE_REGION = {
  US: 'US',
  RU: 'RU',
} as const;

export type MovieStatus = (typeof MOVIE_STATUS)[keyof typeof MOVIE_STATUS];
export type MovieSource = (typeof MOVIE_SOURCE)[keyof typeof MOVIE_SOURCE];
export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];
export type MediaTypeFilter = (typeof MEDIA_TYPE_FILTER)[keyof typeof MEDIA_TYPE_FILTER];
export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
export type UpcomingMovieStatus = (typeof UPCOMING_MOVIE_STATUS)[keyof typeof UPCOMING_MOVIE_STATUS];
export type ReleaseRegion = (typeof RELEASE_REGION)[keyof typeof RELEASE_REGION];

// ============================================
// TYPE EXPORTS
// ============================================

// Movie types (unified)
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;

// Room types
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Swipe = typeof swipes.$inferSelect;
export type NewSwipe = typeof swipes.$inferInsert;

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
export type RoomQueue = typeof roomQueues.$inferSelect;
export type NewRoomQueue = typeof roomQueues.$inferInsert;
export type DeckSettings = typeof deckSettings.$inferSelect;
export type NewDeckSettings = typeof deckSettings.$inferInsert;
export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;

// Upcoming movies types
export type UpcomingMovie = typeof upcomingMovies.$inferSelect;
export type NewUpcomingMovie = typeof upcomingMovies.$inferInsert;
export type NotificationConfig = typeof notificationConfig.$inferSelect;
export type NewNotificationConfig = typeof notificationConfig.$inferInsert;
export type NotificationLog = typeof notificationLog.$inferSelect;
export type NewNotificationLog = typeof notificationLog.$inferInsert;
export type UpcomingSyncStats = typeof upcomingSyncStats.$inferSelect;
export type NewUpcomingSyncStats = typeof upcomingSyncStats.$inferInsert;

// TV Series tracking types
export type TrackedSeries = typeof trackedSeries.$inferSelect;
export type NewTrackedSeries = typeof trackedSeries.$inferInsert;
export type TrackedEpisode = typeof trackedEpisodes.$inferSelect;
export type NewTrackedEpisode = typeof trackedEpisodes.$inferInsert;

// Scheduled notifications types
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type NewScheduledNotification = typeof scheduledNotifications.$inferInsert;
