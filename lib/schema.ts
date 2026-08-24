import { createId } from "@paralleldrive/cuid2";
import { char, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
export const stockState = pgEnum("stock_state", ["unknown", "in_stock", "low_stock", "out_of_stock"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  /** stored lowercased; the login identifier */
  email: text("email").notNull().unique(),
  /** scrypt digest — never a plaintext password */
  passwordHash: text("password_hash").notNull(),
  /** per-user secret for the iOS Shortcut / quick-add endpoint; rotatable */
  quickAddToken: text("quick_add_token")
    .notNull()
    .unique()
    .$defaultFn(() => createId() + createId()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const items = pgTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  /** owner — every read and write is scoped by this */
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  /** availability as last observed; "unknown" whenever the page gave no usable signal */
  stockState: stockState("stock_state").notNull().default("unknown"),
  stockCheckedAt: timestamp("stock_checked_at", { withTimezone: true }),
  /** e-commerce platform, when detected — enables a real add-to-basket link */
  platform: text("platform"),
  /** platform variant id (Shopify), needed to build that link */
  variantId: text("variant_id"),
  /** set when the daily price check sees a drop */
  previousPriceMinor: integer("previous_price_minor"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [index("items_user_id_idx").on(t.userId)]);

export const studioUsage = pgTable(
  "studio_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    /** the cap is per user, so one account cannot exhaust another's allowance */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** calendar month, e.g. "2026-08" */
    month: text("month").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("studio_usage_user_month_idx").on(t.userId, t.month)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
/** what is safe to send to the browser — never the password hash */
export type PublicUser = Pick<User, "id" | "email" | "quickAddToken" | "createdAt">;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemStatus = Item["status"];
export type ItemCategory = Item["category"];
export type FetchState = Item["fetchState"];
export type StockState = Item["stockState"];

export const ITEM_STATUSES = itemStatus.enumValues;
export const ITEM_CATEGORIES = itemCategory.enumValues;
export const FETCH_STATES = fetchState.enumValues;
export const STOCK_STATES = stockState.enumValues;
