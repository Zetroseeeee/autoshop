import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { items, type Item, type NewItem } from "./schema";
import { normaliseUrl, storeOf } from "./url";

export async function listItems(): Promise<Item[]> {
  return db.select().from(items).orderBy(desc(items.createdAt));
}

export async function getItem(id: string): Promise<Item | null> {
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return row ?? null;
}

/** Insert a pending item for a pasted link. Returns null for an unusable URL. */
export async function createItem(rawUrl: string): Promise<Item | null> {
  const url = normaliseUrl(rawUrl);
  if (!url) return null;
  const [row] = await db
    .insert(items)
    .values({ url, store: storeOf(url), fetchState: "pending" })
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

export async function updateItem(id: string, patch: ItemPatch): Promise<Item | null> {
  const [row] = await db.update(items).set(patch).where(eq(items.id, id)).returning();
  return row ?? null;
}

export async function deleteItem(id: string): Promise<boolean> {
  const rows = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  return rows.length > 0;
}

export interface StoreGroup {
  store: string;
  items: Item[];
}

/** Group items by store, stores ordered by first appearance (newest item first). */
export function groupByStore(list: Item[]): StoreGroup[] {
  const map = new Map<string, Item[]>();
  for (const it of list) {
    const arr = map.get(it.store);
    if (arr) arr.push(it);
    else map.set(it.store, [it]);
  }
  return [...map.entries()].map(([store, its]) => ({ store, items: its }));
}
