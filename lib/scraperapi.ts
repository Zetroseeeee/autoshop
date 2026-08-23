import type { FetchedPage } from "./fetchPage";

/**
 * Tier 3 — proxy scraping API (ScraperAPI-compatible GET interface) with JS
 * rendering on. Only used for HARD_SITES when SCRAPER_API_KEY is set.
 */
const ENDPOINT = "https://api.scraperapi.com/";

export function scraperConfigured(): boolean {
  return Boolean(process.env.SCRAPER_API_KEY);
}

export async function scrapeViaApi(url: string, timeoutMs = 50_000): Promise<FetchedPage | null> {
  const key = process.env.SCRAPER_API_KEY;
  if (!key) return null;
  const target = new URL(ENDPOINT);
  target.searchParams.set("api_key", key);
  target.searchParams.set("url", url);
  target.searchParams.set("render", "true");
  target.searchParams.set("country_code", "gb");
  target.searchParams.set("device_type", "mobile");
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const html = await res.text();
    if (!res.ok) {
      console.warn(`[scraperapi] ${res.status} for ${url}: ${html.slice(0, 160)}`);
      return null;
    }
    return { html, status: 200, finalUrl: url };
  } catch (err) {
    console.warn("[scraperapi] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
