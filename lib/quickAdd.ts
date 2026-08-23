import { after } from "next/server";
import { enrichItem } from "./enrichItem";
import { createItem } from "./items";
import type { Item } from "./schema";
import { extractUrl } from "./url";

/** Shared by /api/quick-add and /share: find a link in the provided params and add it. */
export async function addFromParams(params: { url?: string | null; text?: string | null; title?: string | null }): Promise<Item | null> {
  const link = extractUrl(params.url) ?? extractUrl(params.text) ?? extractUrl(params.title);
  if (!link) return null;
  const item = await createItem(link);
  if (item) after(() => enrichItem(item.id));
  return item;
}

export function wantsJson(req: Request): boolean {
  return /application\/json/i.test(req.headers.get("accept") ?? "");
}
