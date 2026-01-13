import { pgTable, integer, varchar, text, timestamp, unique, uuid, boolean, uniqueIndex, foreignKey, index, bigint } from "drizzle-orm/pg-core"



export const movieCache = pgTable("movie_cache", {
	tmdbId: integer("tmdb_id").primaryKey().notNull(),
	title: varchar({ length: 500 }).notNull(),
	titleRu: varchar("title_ru", { length: 500 }),
	overview: text(),
	overviewRu: text("overview_ru"),
	posterPath: varchar("poster_path", { length: 500 }),
	backdropPath: varchar("backdrop_path", { length: 500 }),
	releaseDate: varchar("release_date", { length: 20 }),
	voteAverage: varchar("vote_average", { length: 10 }),
	imdbId: varchar("imdb_id", { length: 20 }),
	imdbRating: varchar("imdb_rating", { length: 10 }),
	rtRating: varchar("rt_rating", { length: 10 }),
	metacriticRating: varchar("metacritic_rating", { length: 10 }),
	genres: text(),
	runtime: integer(),
	cachedAt: timestamp("cached_at", { mode: 'string' }).defaultNow().notNull(),
});

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 10 }).notNull(),
	pin: varchar({ length: 6 }).notNull(),
	status: varchar({ length: 20 }).default('waiting').notNull(),
	userAConnected: boolean("user_a_connected").default(false),
	userBConnected: boolean("user_b_connected").default(false),
	matchedMovieId: integer("matched_movie_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	moviePoolSeed: integer("movie_pool_seed").notNull(),
}, (table) => [
	unique("rooms_code_unique").on(table.code),
]);

export const swipes = pgTable("swipes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	movieId: integer("movie_id").notNull(),
	userSlot: varchar("user_slot", { length: 1 }).notNull(),
	action: varchar({ length: 10 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_swipe_idx").using("btree", table.roomId.asc().nullsLast().op("int4_ops"), table.movieId.asc().nullsLast().op("int4_ops"), table.userSlot.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "swipes_room_id_rooms_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
	telegramUsername: varchar("telegram_username", { length: 255 }),
	firstName: varchar("first_name", { length: 255 }).notNull(),
	lastName: varchar("last_name", { length: 255 }),
	photoUrl: varchar("photo_url", { length: 500 }),
	languageCode: varchar("language_code", { length: 10 }),
	isPremium: boolean("is_premium").default(false),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	referralCode: varchar("referral_code", { length: 12 }).notNull(),
	referredById: uuid("referred_by_id"),
	referredAt: timestamp("referred_at", { mode: 'string' }),
}, (table) => [
	index("users_referral_code_idx").using("btree", table.referralCode.asc().nullsLast().op("text_ops")),
	index("users_referred_by_idx").using("btree", table.referredById.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.referredById],
			foreignColumns: [table.id],
			name: "users_referred_by_id_fkey"
		}).onDelete("set null"),
	unique("users_telegram_id_unique").on(table.telegramId),
	unique("users_referral_code_key").on(table.referralCode),
]);

export const referralRewards = pgTable("referral_rewards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	rewardType: varchar("reward_type", { length: 50 }).notNull(),
	referralCount: integer("referral_count").notNull(),
	rewardValue: text("reward_value"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	claimedAt: timestamp("claimed_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("reward_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("reward_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "referral_rewards_user_id_fkey"
		}).onDelete("cascade"),
]);

export const userSessions = pgTable("user_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	deviceInfo: text("device_info"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("session_expires_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("session_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_sessions_token_hash_unique").on(table.tokenHash),
]);

export const userSwipeHistory = pgTable("user_swipe_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	action: varchar({ length: 10 }).notNull(),
	context: varchar({ length: 20 }),
	roomId: uuid("room_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_user_swipe_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.tmdbId.asc().nullsLast().op("int4_ops")),
	index("user_swipe_action_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.action.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_swipe_history_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "user_swipe_history_room_id_rooms_id_fk"
		}).onDelete("set null"),
]);

export const watchPrompts = pgTable("watch_prompts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	promptedAt: timestamp("prompted_at", { mode: 'string' }).defaultNow().notNull(),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	response: varchar({ length: 20 }),
	snoozeUntil: timestamp("snooze_until", { mode: 'string' }),
}, (table) => [
	index("prompt_user_pending_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.respondedAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("unique_prompt_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tmdbId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "watch_prompts_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userMovieLists = pgTable("user_movie_lists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tmdbId: integer("tmdb_id").notNull(),
	status: varchar({ length: 20 }).notNull(),
	rating: integer(),
	source: varchar({ length: 20 }).notNull(),
	notes: text(),
	watchedAt: timestamp("watched_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	watchStartedAt: timestamp("watch_started_at", { mode: 'string' }),
}, (table) => [
	uniqueIndex("unique_user_movie_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tmdbId.asc().nullsLast().op("int4_ops")),
	index("user_movie_rating_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.rating.asc().nullsLast().op("uuid_ops")),
	index("user_movie_status_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_movie_lists_user_id_users_id_fk"
		}).onDelete("cascade"),
]);
