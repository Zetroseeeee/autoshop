-- Introducing accounts: items and studio usage become owned by a user.
-- There is no user to attribute pre-existing rows to, so any data from the
-- single-user era is removed here. (At the time this ran, that was only
-- throwaway test data.) Take a JSON export from /settings first if you are
-- upgrading a basket you care about.
DELETE FROM "studio_usage";--> statement-breakpoint
DELETE FROM "items";--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"quick_add_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_quick_add_token_unique" UNIQUE("quick_add_token")
);
--> statement-breakpoint
ALTER TABLE "studio_usage" DROP CONSTRAINT "studio_usage_month_unique";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_usage" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_usage" ADD CONSTRAINT "studio_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "studio_usage_user_month_idx" ON "studio_usage" USING btree ("user_id","month");