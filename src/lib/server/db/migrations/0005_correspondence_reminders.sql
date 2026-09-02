-- One deadline reminder per correspondence game per player. The unique pair
-- index is the dedupe contract: the sweeper inserts with ON CONFLICT DO
-- NOTHING and only notifies the player whose insert won, so reminders never
-- repeat no matter how many sweeps race.
CREATE TABLE IF NOT EXISTS "correspondence_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reminded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "correspondence_reminders" ADD CONSTRAINT "correspondence_reminders_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "correspondence_reminders" ADD CONSTRAINT "correspondence_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "correspondence_reminders_game_user_key" ON "correspondence_reminders" ("game_id", "user_id");
