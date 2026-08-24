/** Tier 1 — direct fetch with a realistic mobile Safari identity, through the egress guard. */
import { safeFetch } from "./egress";

export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export const PAGE_HEADERS: Record<string, string> = {
  "user-agent": MOBILE_UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
};

export interface FetchedPage {
  html: string;
  status: number;
  finalUrl: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

export async function fetchHtml(url: string, timeoutMs = 8000): Promise<FetchedPage | null> {
  try {
    const res = await safeFetch(url, { headers: PAGE_HEADERS, timeoutMs });
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain|octet-stream/i.test(type) && res.ok) {
      // e.g. a direct image / PDF link — nothing to parse
      return { html: "", status: res.status, finalUrl: res.url || url };
    }
    const html = await readCapped(res, MAX_BYTES);
    return { html, status: res.status, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= max) {
        void reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
