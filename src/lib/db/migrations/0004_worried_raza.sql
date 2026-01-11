CREATE TABLE "deck_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"show_watched_movies" boolean DEFAULT false,
	"min_rating_filter" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deck_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"watch_reminders" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_type" varchar(50) NOT NULL,
	"referral_count" integer NOT NULL,
	"reward_value" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_slot" varchar(1) NOT NULL,
	"base_pool_direction" varchar(4) NOT NULL,
	"current_base_index" integer NOT NULL,
	"priority_queue" text DEFAULT '[]' NOT NULL,
	"priority_queue_index" integer DEFAULT 0 NOT NULL,
	"excluded_ids" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movie_cache" ADD COLUMN "vote_count" integer;--> statement-breakpoint
ALTER TABLE "movie_cache" ADD COLUMN "popularity" varchar(20);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "user_a_id" uuid;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "user_b_id" uuid;--> statement-breakpoint
ALTER TABLE "user_movie_lists" ADD COLUMN "watch_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar(12);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_at" timestamp;--> statement-breakpoint
ALTER TABLE "deck_settings" ADD CONSTRAINT "deck_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_queues" ADD CONSTRAINT "room_queues_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reward_user_idx" ON "referral_rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reward_status_idx" ON "referral_rewards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_room_queue_idx" ON "room_queues" USING btree ("room_id","user_slot");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code");