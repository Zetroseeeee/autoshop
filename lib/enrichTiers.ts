import { isHardSite, isJsSite, type EnrichOptions } from "./enrich";
import { geminiConfigured, inferBrandCategory } from "./gemini";
import { parseProductHtml } from "./parse";
import { renderHtml } from "./render";
import { scrapeViaApi, scraperConfigured } from "./scraperapi";

/** Tiers 2–4 for the live pipeline (spec §6). Tier 1 lives in ./enrich. */
export function liveTiers(): EnrichOptions {
  return {
    tiers: [
      {
        name: "tier2",
        // rendered fetch only for known JS sites or pages that looked like an app shell
        when: (p, host) => isJsSite(host) || p.appShell,
        run: async (url) => {
          const page = await renderHtml(url);
          if (!page) return null;
          return parseProductHtml(page.html, page.finalUrl || url, { status: page.status });
        },
      },
      {
        name: "tier3",
        when: (_p, host) => scraperConfigured() && isHardSite(host),
        run: async (url) => {
          const page = await scrapeViaApi(url);
          if (!page) return null;
          return parseProductHtml(page.html, url, { status: page.status });
        },
      },
    ],
    textFallback: geminiConfigured() ? inferBrandCategory : undefined,
  };
}
