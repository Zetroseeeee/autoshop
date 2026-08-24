import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { decideStock, tier1 } from "./enrich";
import { items, type Item } from "./schema";

/**
 * Daily price check (stretch): re-run Tier 1 on `want` items across every account. On a drop, remember
 * the old price so the row can show a struck-through "was £x" badge. Never
 * touches names or manual edits; a missing price leaves the stored one alone.
 */
export interface PriceCheckSummary {
  checked: number;
  drops: number;
  rises: number;
  unchanged: number;
  noPrice: number;
  errors: number;
  /** items that became unavailable since the last check */
  wentOutOfStock: number;
  backInStock: number;
}

const BATCH = 40;
const CONCURRENCY = 4;

export async function runPriceCheck(): Promise<PriceCheckSummary> {
  const batch = await db
    .select()
    .from(items)
    .where(eq(items.status, "want"))
    .orderBy(sql`${items.lastCheckedAt} asc nulls first`, asc(items.createdAt))
    .limit(BATCH);

  const summary: PriceCheckSummary = { checked: 0, drops: 0, rises: 0, unchanged: 0, noPrice: 0, errors: 0, wentOutOfStock: 0, backInStock: 0 };
  const queue = [...batch];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        await checkOne(item, summary);
      } catch (err) {
        summary.errors++;
        console.warn(`[price-check] ${item.id} failed:`, err instanceof Error ? err.message : err);
      }
    }
  });
  await Promise.all(workers);
  return summary;
}

async function checkOne(item: Item, summary: PriceCheckSummary): Promise<void> {
  const parsed = await tier1(item.url);
  summary.checked++;
  const now = new Date();

  // Stock first — a listing can sell out while its price still parses fine.
  const stock = decideStock(parsed, item);
  if (stock !== "unknown" && stock !== item.stockState) {
    if (stock === "out_of_stock") summary.wentOutOfStock++;
    else if (item.stockState === "out_of_stock") summary.backInStock++;
  }
  if (stock !== "unknown") {
    await db
      .update(items)
      .set({ stockState: stock, stockCheckedAt: now })
      .where(and(eq(items.id, item.id), eq(items.userId, item.userId)));
  }
  const found = parsed.priceMinor;
  const sameCurrency = !item.currency || !parsed.currency || parsed.currency === item.currency;

  if (found == null || !sameCurrency) {
    summary.noPrice++;
    await db.update(items).set({ lastCheckedAt: now }).where(and(eq(items.id, item.id), eq(items.userId, item.userId)));
    return;
  }
  if (item.priceMinor == null) {
    // first time we see a price for a manually-added item: just record it
    await db
      .update(items)
      .set({ priceMinor: found, currency: parsed.currency ?? item.currency ?? "GBP", lastCheckedAt: now, sourceImageUrl: item.sourceImageUrl ?? parsed.imageUrl ?? null })
      .where(and(eq(items.id, item.id), eq(items.userId, item.userId)));
    summary.unchanged++;
    return;
  }
  if (found < item.priceMinor) {
    summary.drops++;
    await db
      .update(items)
      .set({ previousPriceMinor: item.priceMinor, priceMinor: found, lastCheckedAt: now })
      .where(and(eq(items.id, item.id), eq(items.userId, item.userId), eq(items.priceMinor, item.priceMinor)));
    return;
  }
  if (found > item.priceMinor) {
    summary.rises++;
    await db.update(items).set({ priceMinor: found, previousPriceMinor: null, lastCheckedAt: now }).where(and(eq(items.id, item.id), eq(items.userId, item.userId)));
    return;
  }
  summary.unchanged++;
  await db.update(items).set({ lastCheckedAt: now }).where(and(eq(items.id, item.id), eq(items.userId, item.userId)));
}
