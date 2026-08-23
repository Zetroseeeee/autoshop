import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { listItems } from "@/lib/items";
import { items, type NewItem } from "@/lib/schema";
import { normaliseUrl, storeOf } from "@/lib/url";
import { BadRequest, errorResponse, parseItemPatch } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Import a previous JSON export. Items whose URL is already in the basket are skipped. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items)) throw new BadRequest("Expected a Basket export with an items array");
    if (body.items.length > 2000) throw new BadRequest("That file has too many items");

    const existing = new Set((await listItems()).map((i) => i.url));
    const rows: NewItem[] = [];
    let skipped = 0;
    for (const raw of body.items) {
      if (!raw || typeof raw !== "object") {
        skipped++;
        continue;
      }
      const r = raw as Record<string, unknown>;
      const url = typeof r.url === "string" ? normaliseUrl(r.url) : null;
      if (!url || existing.has(url)) {
        skipped++;
        continue;
      }
      existing.add(url);
      const patch = safePatch(r);
      rows.push({
        url,
        store: storeOf(url),
        name: patch.name ?? "",
        brand: patch.brand ?? null,
        priceMinor: patch.priceMinor ?? null,
        currency: patch.currency ?? null,
        qty: patch.qty ?? 1,
        status: patch.status ?? "want",
        category: patch.category ?? "other",
        sourceImageUrl: patch.sourceImageUrl ?? null,
        studioImageUrl: typeof r.studioImageUrl === "string" && /^https?:\/\//.test(r.studioImageUrl) ? r.studioImageUrl : null,
        studioBackUrl: typeof r.studioBackUrl === "string" && /^https?:\/\//.test(r.studioBackUrl) ? r.studioBackUrl : null,
        fetchState: patch.name && patch.priceMinor != null && patch.sourceImageUrl ? "ok" : patch.name || patch.priceMinor != null || patch.sourceImageUrl ? "partial" : "failed",
        previousPriceMinor: typeof r.previousPriceMinor === "number" && Number.isInteger(r.previousPriceMinor) ? r.previousPriceMinor : null,
      });
    }
    if (rows.length) await db.insert(items).values(rows);
    return Response.json({ imported: rows.length, skipped });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Reuse the PATCH validator field-by-field so one bad field doesn't sink the row. */
function safePatch(r: Record<string, unknown>) {
  const out: ReturnType<typeof parseItemPatch> = {};
  for (const key of ["name", "brand", "priceMinor", "currency", "qty", "status", "category", "sourceImageUrl"] as const) {
    if (!(key in r)) continue;
    try {
      Object.assign(out, parseItemPatch({ [key]: r[key] }));
    } catch {
      /* skip invalid field */
    }
  }
  return out;
}
