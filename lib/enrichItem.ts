import { applyEnrichment, enrichUrl } from "./enrich";
import { getItem, updateItem } from "./items";
import type { Item } from "./schema";

/**
 * Enrich a stored item end-to-end. Safe to run in `after()`; never throws.
 * Tiers 2–4 and auto-studio are wired in here once they exist (stage 7/8).
 */
export async function enrichItem(itemId: string): Promise<Item | null> {
  const item = await getItem(itemId);
  if (!item) return null;
  try {
    const result = await enrichUrl(item.url);
    console.log(`[enrich] ${item.store} → ${result.fetchState} via ${result.tiers.join(">")}`, result.sources);
    return await applyEnrichment(item, result);
  } catch (err) {
    console.error(`[enrich] ${item.id} failed`, err);
    return await updateItem(itemId, { fetchState: "failed", lastCheckedAt: new Date() });
  }
}
