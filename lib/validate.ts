import { ITEM_CATEGORIES, ITEM_STATUSES } from "./schema";
import type { ItemPatch } from "./items";

export class BadRequest extends Error {}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** Validate a PATCH body into a safe item patch. Unknown keys are ignored. */
export function parseItemPatch(body: unknown): ItemPatch {
  if (!body || typeof body !== "object") throw new BadRequest("Expected a JSON object");
  const b = body as Record<string, unknown>;
  const patch: ItemPatch = {};

  if ("name" in b) {
    if (typeof b.name !== "string") throw new BadRequest("name must be a string");
    patch.name = b.name.trim().slice(0, 300);
  }
  if ("brand" in b) {
    if (b.brand !== null && typeof b.brand !== "string") throw new BadRequest("brand must be a string or null");
    patch.brand = b.brand ? (b.brand as string).trim().slice(0, 120) || null : null;
  }
  if ("priceMinor" in b) {
    if (b.priceMinor !== null && (!isInt(b.priceMinor) || b.priceMinor < 0 || b.priceMinor >= 10_000_000))
      throw new BadRequest("priceMinor must be an integer in minor units (0 – 9,999,999) or null");
    patch.priceMinor = b.priceMinor as number | null;
  }
  if ("currency" in b) {
    if (b.currency !== null && !(typeof b.currency === "string" && /^[A-Za-z]{3}$/.test(b.currency)))
      throw new BadRequest("currency must be a 3-letter code or null");
    patch.currency = b.currency ? (b.currency as string).toUpperCase() : null;
  }
  if ("qty" in b) {
    if (!isInt(b.qty) || b.qty < 1 || b.qty > 99) throw new BadRequest("qty must be 1 – 99");
    patch.qty = b.qty;
  }
  if ("status" in b) {
    if (!ITEM_STATUSES.includes(b.status as (typeof ITEM_STATUSES)[number])) throw new BadRequest("invalid status");
    patch.status = b.status as ItemPatch["status"];
  }
  if ("category" in b) {
    if (!ITEM_CATEGORIES.includes(b.category as (typeof ITEM_CATEGORIES)[number])) throw new BadRequest("invalid category");
    patch.category = b.category as ItemPatch["category"];
  }
  if ("sourceImageUrl" in b) {
    if (b.sourceImageUrl !== null && typeof b.sourceImageUrl !== "string") throw new BadRequest("sourceImageUrl must be a URL or null");
    const v = (b.sourceImageUrl as string | null)?.trim() || null;
    if (v && !/^https?:\/\//i.test(v)) throw new BadRequest("sourceImageUrl must start with http(s)://");
    patch.sourceImageUrl = v;
  }
  if (Object.keys(patch).length === 0) throw new BadRequest("Nothing to update");
  return patch;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 });
  console.error(err);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
