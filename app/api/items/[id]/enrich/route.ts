import type { NextRequest } from "next/server";
import { enrichItem } from "@/lib/enrichItem";
import { getItem, updateItem } from "@/lib/items";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Retry auto-fetch. Runs synchronously so the editor can show the outcome. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  try {
    const { id } = await ctx.params;
    const existing = await getItem(id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    await updateItem(id, { fetchState: "pending" });
    const item = await enrichItem(id);
    return Response.json({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
