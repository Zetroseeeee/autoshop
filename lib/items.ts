import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { items, type Item, type NewItem } from "./schema";
import { normaliseUrl, storeOf } from "./url";

/**
 * Every function here takes the owning userId and filters on it. There is no
 * unscoped read or write of an item anywhere in the app — that is what keeps
 * one account's basket invisible to another.
 */

export async function listItems(userId: string): Promise<Item[]> {
  return db.select().from(items).where(eq(items.userId, userId)).orderBy(desc(items.createdAt));
}

export async function getItem(userId: string, id: string): Promise<Item | null> {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Insert a pending item for a pasted link. Returns null for an unusable URL. */
export async function createItem(userId: string, rawUrl: string): Promise<Item | null> {
  const url = normaliseUrl(rawUrl);
  if (!url) return null;
  const [row] = await db
    .insert(items)
    .values({ userId, url, store: storeOf(url), fetchState: "pending" })
    .returning();
  return row ?? null;
}

export type ItemPatch = Partial<
  Pick<
    NewItem,
    | "name"
    | "brand"
    | "priceMinor"
    | "currency"
    | "qty"
    | "status"
    | "category"
    | "sourceImageUrl"
    | "studioImageUrl"
    | "studioBackUrl"
    | "fetchState"
    | "previousPriceMinor"
    | "lastCheckedAt"
  >
>;

export async function updateItem(userId: string, id: string, patch: ItemPatch): Promise<Item | null> {
  const [row] = await db
    .update(items)
    .set(patch)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning({ id: items.id });
  return rows.length > 0;
}
