import { createId } from "@paralleldrive/cuid2";
import { char, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const itemStatus = pgEnum("item_status", ["want", "ordered", "arrived"]);
export const itemCategory = pgEnum("item_category", [
  "jacket",
  "top",
  "trousers",
  "shoes",
  "accessory",
  "other",
]);
export const fetchState = pgEnum("fetch_state", ["pending", "ok", "partial", "failed"]);

export const items = pgTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  url: text("url").notNull(),
  /** hostname without www, e.g. "asos.com" */
  store: text("store").notNull(),
  /** empty string = not known yet */
  name: text("name").notNull().default(""),
  brand: text("brand"),
  /** money in minor units (pence/cents) */
  priceMinor: integer("price_minor"),
  currency: char("currency", { length: 3 }),
  qty: integer("qty").notNull().default(1),
  status: itemStatus("status").notNull().default("want"),
  category: itemCategory("category").notNull().default("other"),
  sourceImageUrl: text("source_image_url"),
  studioImageUrl: text("studio_image_url"),
  studioBackUrl: text("studio_back_url"),
  fetchState: fetchState("fetch_state").notNull().default("pending"),
  /** set when the daily price check sees a drop */
  previousPriceMinor: integer("previous_price_minor"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const studioUsage = pgTable("studio_usage", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  /** calendar month, e.g. "2026-08" */
  month: text("month").notNull().unique(),
  count: integer("count").notNull().default(0),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemStatus = Item["status"];
export type ItemCategory = Item["category"];
export type FetchState = Item["fetchState"];

export const ITEM_STATUSES = itemStatus.enumValues;
export const ITEM_CATEGORIES = itemCategory.enumValues;
export const FETCH_STATES = fetchState.enumValues;
