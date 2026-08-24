CREATE TYPE "public"."stock_state" AS ENUM('unknown', 'in_stock', 'low_stock', 'out_of_stock');--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "stock_state" "stock_state" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "stock_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "variant_id" text;