CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer,
	"imdb_id" varchar(20),
	"kinopoisk_id" integer,
	"title" varchar(500) NOT NULL,
	"title_ru" varchar(500),
	"title_original" varchar(500),
	"overview" text,
	"overview_ru" text,
	"poster_path" varchar(500),
	"poster_url" varchar(500),
	"backdrop_path" varchar(500),
	"release_date" varchar(20),
	"runtime" integer,
	"genres" text,
	"tmdb_rating" varchar(10),
	"tmdb_vote_count" integer,
	"tmdb_popularity" varchar(20),
	"imdb_rating" varchar(10),
	"kinopoisk_rating" varchar(10),
	"rt_rating" varchar(10),
	"metacritic_rating" varchar(10),
	"primary_source" varchar(20) NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movies_tmdb_id_unique" UNIQUE("tmdb_id"),
	CONSTRAINT "movies_imdb_id_unique" UNIQUE("imdb_id"),
	CONSTRAINT "movies_kinopoisk_id_unique" UNIQUE("kinopoisk_id")
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "unified_matched_movie_id" uuid;--> statement-breakpoint
ALTER TABLE "swipes" ADD COLUMN "unified_movie_id" uuid;--> statement-breakpoint
ALTER TABLE "user_movie_lists" ADD COLUMN "unified_movie_id" uuid;--> statement-breakpoint
ALTER TABLE "user_swipe_history" ADD COLUMN "unified_movie_id" uuid;--> statement-breakpoint
ALTER TABLE "watch_prompts" ADD COLUMN "unified_movie_id" uuid;--> statement-breakpoint
CREATE INDEX "movies_tmdb_idx" ON "movies" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "movies_imdb_idx" ON "movies" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "movies_kinopoisk_idx" ON "movies" USING btree ("kinopoisk_id");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_unified_matched_movie_id_movies_id_fk" FOREIGN KEY ("unified_matched_movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_unified_movie_id_movies_id_fk" FOREIGN KEY ("unified_movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_lists" ADD CONSTRAINT "user_movie_lists_unified_movie_id_movies_id_fk" FOREIGN KEY ("unified_movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_swipe_history" ADD CONSTRAINT "user_swipe_history_unified_movie_id_movies_id_fk" FOREIGN KEY ("unified_movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_prompts" ADD CONSTRAINT "watch_prompts_unified_movie_id_movies_id_fk" FOREIGN KEY ("unified_movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "swipe_unified_idx" ON "swipes" USING btree ("room_id","unified_movie_id","user_slot");--> statement-breakpoint
CREATE INDEX "user_movie_unified_idx" ON "user_movie_lists" USING btree ("user_id","unified_movie_id");--> statement-breakpoint
CREATE INDEX "user_swipe_unified_idx" ON "user_swipe_history" USING btree ("user_id","unified_movie_id");--> statement-breakpoint
CREATE INDEX "prompt_unified_idx" ON "watch_prompts" USING btree ("user_id","unified_movie_id");