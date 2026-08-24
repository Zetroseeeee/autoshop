import { after, type NextRequest } from "next/server";
import { enrichItem } from "@/lib/enrichItem";
import { createItem, listItems } from "@/lib/items";
import type { Item } from "@/lib/schema";
import { requireUser } from "@/lib/session";
import { extractUrl } from "@/lib/url";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    return Response.json({ items: await listItems(auth.user.id) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST { url } — or { text } containing one or more links. Creates pending rows, enriches after responding. */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: unknown; text?: unknown };
    const raw = typeof body.url === "string" ? body.url : typeof body.text === "string" ? body.text : "";
    const links = splitLinks(raw);
    if (!links.length) return Response.json({ error: "Paste a product link" }, { status: 400 });

    const created: Item[] = [];
    for (const link of links.slice(0, 10)) {
      const item = await createItem(userId, link);
      if (item) created.push(item);
    }
    if (!created.length) return Response.json({ error: "That doesn't look like a link" }, { status: 400 });

    after(async () => {
      for (const item of created) await enrichItem(userId, item.id);
    });
    return Response.json({ items: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

function splitLinks(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/\s+/)) {
    const url = extractUrl(token);
    if (url && !out.includes(url)) out.push(url);
  }
  if (!out.length) {
    const single = extractUrl(text);
    if (single) out.push(single);
  }
  return out;
}
