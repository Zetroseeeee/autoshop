import { eq } from "drizzle-orm";
import { guessCategory } from "./category";
import { db } from "./db";
import { fetchHtml } from "./fetchPage";
import { classify, parseProductHtml, type Parsed } from "./parse";
import { items, type Item, type ItemCategory } from "./schema";
import { hostOf, slugWords } from "./url";

/**
 * Enrichment pipeline (spec §6). Tier 1 = direct fetch + parse. Tiers 2–4 are
 * layered on in ./enrichTiers. Nothing here ever fabricates a price or image.
 */

/** Hosts that render product data client-side; Tier 2 is allowed for these. */
export const JS_SITES = [
  "uniqlo.com", "zara.com", "hm.com", "nike.com", "adidas.co.uk", "adidas.com", "farfetch.com",
  "ssense.com", "mrporter.com", "net-a-porter.com", "selfridges.com", "weekday.com", "arket.com",
  "cos.com", "stories.com", "size.co.uk", "jdsports.co.uk", "footpatrol.com", "goat.com", "stockx.com",
  "mango.com", "bershka.com", "pullandbear.com", "massimodutti.com", "newbalance.co.uk", "newbalance.com",
];

/** Bot-walled hosts where only a proxy scraping API has a realistic chance (Tier 3). */
export const HARD_SITES = ["vinted.", "depop.com", "grailed.com", "ebay.", "zara.com", "stockx.com", "goat.com"];

export function matchesSite(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  if (pattern.endsWith(".")) return `.${h}`.includes(`.${pattern}`);
  return h === pattern || h.endsWith(`.${pattern}`);
}

export const isJsSite = (host: string) => JS_SITES.some((p) => matchesSite(host, p));
export const isHardSite = (host: string) => HARD_SITES.some((p) => matchesSite(host, p));

export interface EnrichResult {
  name?: string;
  brand?: string;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string;
  category?: ItemCategory;
  fetchState: "ok" | "partial" | "failed";
  /** diagnostics: which tier/rule produced each field */
  sources: Record<string, string>;
  tiers: string[];
}

export const needsMore = (p: Parsed) => p.priceMinor == null || !p.imageUrl;

/** Fill empty fields in `base` from `extra`. */
export function mergeParsed(base: Parsed, extra: Parsed | null | undefined, tier: string): Parsed {
  if (!extra) return base;
  const out: Parsed = { ...base, sources: { ...base.sources } };
  for (const key of ["name", "brand", "imageUrl"] as const) {
    if (!out[key] && extra[key]) {
      out[key] = extra[key];
      out.sources[key] = `${tier}:${extra.sources[key] ?? "?"}`;
    }
  }
  if (out.priceMinor == null && extra.priceMinor != null) {
    out.priceMinor = extra.priceMinor;
    out.currency = extra.currency;
    out.sources.price = `${tier}:${extra.sources.price ?? "?"}`;
  }
  out.botWall = base.botWall && (extra.botWall ?? true);
  out.appShell = base.appShell && extra.appShell;
  return out;
}

/** Tier 1: direct fetch + parse. */
export async function tier1(url: string): Promise<Parsed> {
  const page = await fetchHtml(url, 8000);
  if (!page) return { botWall: false, appShell: false, sources: { fetch: "network-error" } };
  const parsed = parseProductHtml(page.html, page.finalUrl || url, { status: page.status });
  parsed.sources.tier1 = `status:${page.status}`;
  return parsed;
}

export type TierRunner = (url: string, host: string, soFar: Parsed) => Promise<Parsed | null>;

export interface EnrichOptions {
  /** extra tiers, run in order while fields are still missing (installed by ./enrichTiers) */
  tiers?: Array<{ name: string; when: (p: Parsed, host: string) => boolean; run: TierRunner }>;
  /** AI text fallback for brand/category only */
  textFallback?: (input: { name?: string; brand?: string; url: string; slug: string }) => Promise<{ brand?: string; category?: ItemCategory } | null>;
}

/** Run the whole pipeline for a URL. Pure with respect to the database. */
export async function enrichUrl(url: string, opts: EnrichOptions = {}): Promise<EnrichResult> {
  const host = hostOf(url);
  const tiers: string[] = ["tier1"];
  let parsed = await tier1(url);

  for (const tier of opts.tiers ?? []) {
    if (!needsMore(parsed) || !tier.when(parsed, host)) continue;
    tiers.push(tier.name);
    try {
      const extra = await tier.run(url, host, parsed);
      parsed = mergeParsed(parsed, extra, tier.name);
    } catch (err) {
      parsed.sources[`${tier.name}Error`] = err instanceof Error ? err.message.slice(0, 120) : "error";
    }
  }

  const slug = slugWords(url);
  let category = guessCategory(parsed.name, slug);
  let brand = parsed.brand;
  if ((!brand || category === "other") && opts.textFallback && (parsed.name || slug)) {
    tiers.push("tier4");
    try {
      const ai = await opts.textFallback({ name: parsed.name, brand, url, slug });
      if (ai?.brand && !brand) {
        brand = ai.brand;
        parsed.sources.brand = "tier4:ai";
      }
      if (ai?.category && category === "other") {
        category = ai.category;
        parsed.sources.category = "tier4:ai";
      }
    } catch (err) {
      parsed.sources.tier4Error = err instanceof Error ? err.message.slice(0, 120) : "error";
    }
  }

  return {
    name: parsed.name,
    brand,
    priceMinor: parsed.priceMinor,
    currency: parsed.currency,
    imageUrl: parsed.imageUrl,
    category,
    fetchState: classify(parsed),
    sources: parsed.sources,
    tiers,
  };
}

/** Apply an enrichment result to a stored item. Manual values are kept when the fetch found nothing. */
export async function applyEnrichment(item: Item, r: EnrichResult): Promise<Item> {
  const [updated] = await db
    .update(items)
    .set({
      name: r.name ?? item.name,
      brand: r.brand ?? item.brand,
      priceMinor: r.priceMinor ?? item.priceMinor,
      currency: r.priceMinor != null ? (r.currency ?? item.currency ?? "GBP") : item.currency,
      sourceImageUrl: r.imageUrl ?? item.sourceImageUrl,
      category: item.category === "other" && r.category ? r.category : item.category,
      fetchState: r.fetchState,
      lastCheckedAt: new Date(),
    })
    .where(eq(items.id, item.id))
    .returning();
  return updated ?? item;
}
