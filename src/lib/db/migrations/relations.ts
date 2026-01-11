import { relations } from "drizzle-orm/relations";
import { rooms, swipes, users, referralRewards, userSessions, userSwipeHistory, watchPrompts, userMovieLists } from "./schema";

export const swipesRelations = relations(swipes, ({one}) => ({
	room: one(rooms, {
		fields: [swipes.roomId],
		references: [rooms.id]
	}),
}));

export const roomsRelations = relations(rooms, ({many}) => ({
	swipes: many(swipes),
	userSwipeHistories: many(userSwipeHistory),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	user: one(users, {
		fields: [users.referredById],
		references: [users.id],
		relationName: "users_referredById_users_id"
	}),
	users: many(users, {
		relationName: "users_referredById_users_id"
	}),
	referralRewards: many(referralRewards),
	userSessions: many(userSessions),
	userSwipeHistories: many(userSwipeHistory),
	watchPrompts: many(watchPrompts),
	userMovieLists: many(userMovieLists),
}));

export const referralRewardsRelations = relations(referralRewards, ({one}) => ({
	user: one(users, {
		fields: [referralRewards.userId],
		references: [users.id]
	}),
}));

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
}));

export const userSwipeHistoryRelations = relations(userSwipeHistory, ({one}) => ({
	user: one(users, {
		fields: [userSwipeHistory.userId],
		references: [users.id]
	}),
	room: one(rooms, {
		fields: [userSwipeHistory.roomId],
		references: [rooms.id]
	}),
}));

export const watchPromptsRelations = relations(watchPrompts, ({one}) => ({
	user: one(users, {
		fields: [watchPrompts.userId],
		references: [users.id]
	}),
}));

export const userMovieListsRelations = relations(userMovieLists, ({one}) => ({
	user: one(users, {
		fields: [userMovieLists.userId],
		references: [users.id]
	}),
}));