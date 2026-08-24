import { after } from "next/server";
import { enrichItem } from "./enrichItem";
import { createItem } from "./items";
import type { Item } from "./schema";
import { extractUrl } from "./url";

/** Shared by /api/quick-add and /share: find a link in the provided params and add it. */
export async function addFromParams(userId: string, params: { url?: string | null; text?: string | null; title?: string | null }): Promise<Item | null> {
  const link = extractUrl(params.url) ?? extractUrl(params.text) ?? extractUrl(params.title);
  if (!link) return null;
  const item = await createItem(userId, link);
  if (item) after(() => enrichItem(userId, item.id));
  return item;
}

/**
 * True when a cookie-authenticated state change was initiated by another site.
 * The session cookie is SameSite=Lax, which still rides top-level cross-site GETs,
 * so an attacker page could otherwise navigate a signed-in victim here and add to
 * their basket. `none` (typed / OS share sheet) and same-site are legitimate.
 */
export function isCrossSiteRequest(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "cross-site";
  const origin = req.headers.get("origin");
  if (!origin) return false; // no Origin on a plain navigation from the address bar
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function wantsJson(req: Request): boolean {
  return /application\/json/i.test(req.headers.get("accept") ?? "");
}
