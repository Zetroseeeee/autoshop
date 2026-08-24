import { applyEnrichment, enrichUrl } from "./enrich";
import { liveTiers } from "./enrichTiers";
import { getItem, updateItem } from "./items";
import type { Item } from "./schema";
import { autoStudioEnabled, generateStudio, studioConfigured } from "./studio";

/**
 * Enrich a stored item end-to-end. Safe to run in `after()`; never throws.
 * With AUTO_STUDIO=true a studio packshot is generated right after a successful fetch.
 */
export async function enrichItem(userId: string, itemId: string): Promise<Item | null> {
  const item = await getItem(userId, itemId);
  if (!item) return null;
  try {
    const result = await enrichUrl(item.url, liveTiers());
    console.log(`[enrich] ${item.store} → ${result.fetchState} via ${result.tiers.join(">")}`, result.sources);
    let updated = await applyEnrichment(item, result);
    if (autoStudioEnabled() && studioConfigured() && updated.sourceImageUrl && !updated.studioImageUrl) {
      try {
        const outcome = await generateStudio(userId, updated.id);
        updated = outcome.item;
        if (outcome.message) console.log(`[studio] ${updated.id}: ${outcome.message}`);
      } catch (err) {
        console.warn(`[studio] auto-generation failed for ${updated.id}:`, err instanceof Error ? err.message : err);
      }
    }
    return updated;
  } catch (err) {
    console.error(`[enrich] ${item.id} failed`, err);
    return await updateItem(userId, itemId, { fetchState: "failed", lastCheckedAt: new Date() });
  }
}
