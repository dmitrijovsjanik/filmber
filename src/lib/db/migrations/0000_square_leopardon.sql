CREATE TABLE "movie_cache" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"title_ru" varchar(500),
	"overview" text,
	"overview_ru" text,
	"poster_path" varchar(500),
	"backdrop_path" varchar(500),
	"release_date" varchar(20),
	"vote_average" varchar(10),
	"imdb_id" varchar(20),
	"imdb_rating" varchar(10),
	"rt_rating" varchar(10),
	"metacritic_rating" varchar(10),
	"genres" text,
	"runtime" integer,
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"pin" varchar(6) NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"user_a_connected" boolean DEFAULT false,
	"user_b_connected" boolean DEFAULT false,
	"matched_movie_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"movie_pool_seed" integer NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"user_slot" varchar(1) NOT NULL,
	"action" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_swipe_idx" ON "swipes" USING btree ("room_id","movie_id","user_slot");