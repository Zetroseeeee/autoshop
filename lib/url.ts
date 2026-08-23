/** URL helpers: extraction from shared text, normalisation, store hostname. */

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "ttclid", "twclid", "igshid",
  "mc_cid", "mc_eid", "srsltid", "yclid", "_ga", "_gl", "_hsenc", "_hsmi", "ref", "ref_",
  "referrer", "affid", "aff_id", "cjevent", "cjdata", "awc", "irclickid", "sscid", "epik",
  "si", "s_kwcid", "ef_id", "mkt_tok", "vero_id", "nb_klid", "utm_id",
]);

const URL_RE = /https?:\/\/[^\s<>"'“”‘’]+|(?:^|\s)((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s<>"'“”‘’]*)/i;

/** Pull the first URL out of free text (share sheets often send "title + url"). */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  if (!m) return null;
  const raw = (m[1] ?? m[0]).trim().replace(/[)\].,;!?]+$/, "");
  return raw || null;
}

/** Normalise a pasted product link: add https, drop tracking params and fragments. */
export function normaliseUrl(input: string): string | null {
  let raw = extractUrl(input.trim()) ?? input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw.replace(/^\/*/, "")}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".")) return null;
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || TRACKING_PARAMS.has(k)) url.searchParams.delete(key);
  }
  if ([...url.searchParams.keys()].length === 0) url.search = "";
  if (url.username || url.password) return null;
  return url.toString();
}

/** Store identifier: hostname without a leading www. */
export function storeOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** "salomon-xt-6-sneaker-l49306600" → "salomon xt 6 sneaker" (used by the AI text fallback). */
export function slugWords(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname
      .split("/")
      .filter(Boolean)
      .filter((p) => !/^(prd|products?|items?|p|dp|itm|gb|uk|en|us|men|women|shop)$/i.test(p))
      .pop();
    if (!last) return "";
    return last
      .replace(/\.html?$/i, "")
      .replace(/[-_+]+/g, " ")
      .replace(/\b[0-9a-f]{8,}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}
