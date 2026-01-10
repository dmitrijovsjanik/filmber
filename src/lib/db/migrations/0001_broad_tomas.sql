CREATE TABLE "user_movie_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"rating" integer,
	"source" varchar(20) NOT NULL,
	"notes" text,
	"watched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"device_info" text,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_swipe_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"action" varchar(10) NOT NULL,
	"context" varchar(20),
	"room_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"telegram_username" varchar(255),
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"photo_url" varchar(500),
	"language_code" varchar(10),
	"is_premium" boolean DEFAULT false,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "watch_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"prompted_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"response" varchar(20),
	"snooze_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_movie_lists" ADD CONSTRAINT "user_movie_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_swipe_history" ADD CONSTRAINT "user_swipe_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_swipe_history" ADD CONSTRAINT "user_swipe_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_prompts" ADD CONSTRAINT "watch_prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_movie_idx" ON "user_movie_lists" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "user_movie_status_idx" ON "user_movie_lists" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_movie_rating_idx" ON "user_movie_lists" USING btree ("user_id","rating");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_swipe_idx" ON "user_swipe_history" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "user_swipe_action_idx" ON "user_swipe_history" USING btree ("user_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_prompt_idx" ON "watch_prompts" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "prompt_user_pending_idx" ON "watch_prompts" USING btree ("user_id","responded_at");