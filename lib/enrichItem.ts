import { applyEnrichment, enrichUrl } from "./enrich";
import { liveTiers } from "./enrichTiers";
import { getItem, updateItem } from "./items";
import type { Item } from "./schema";

/**
 * Enrich a stored item end-to-end. Safe to run in `after()`; never throws.
 * Auto-studio (AUTO_STUDIO=true) is wired in here in stage 8.
 */
export async function enrichItem(itemId: string): Promise<Item | null> {
  const item = await getItem(itemId);
  if (!item) return null;
  try {
    const result = await enrichUrl(item.url, liveTiers());
    console.log(`[enrich] ${item.store} → ${result.fetchState} via ${result.tiers.join(">")}`, result.sources);
    return await applyEnrichment(item, result);
  } catch (err) {
    console.error(`[enrich] ${item.id} failed`, err);
    return await updateItem(itemId, { fetchState: "failed", lastCheckedAt: new Date() });
  }
}
