CREATE TYPE "public"."fetch_state" AS ENUM('pending', 'ok', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_category" AS ENUM('jacket', 'top', 'trousers', 'shoes', 'accessory', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('want', 'ordered', 'arrived');--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"store" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"brand" text,
	"price_minor" integer,
	"currency" char(3),
	"qty" integer DEFAULT 1 NOT NULL,
	"status" "item_status" DEFAULT 'want' NOT NULL,
	"category" "item_category" DEFAULT 'other' NOT NULL,
	"source_image_url" text,
	"studio_image_url" text,
	"studio_back_url" text,
	"fetch_state" "fetch_state" DEFAULT 'pending' NOT NULL,
	"previous_price_minor" integer,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "studio_usage_month_unique" UNIQUE("month")
);
