import type { NextRequest } from "next/server";
import { enrichItem } from "@/lib/enrichItem";
import { getItem, updateItem } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Retry auto-fetch. Runs synchronously so the editor can show the outcome. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  try {
    const { id } = await ctx.params;
    const existing = await getItem(userId, id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    await updateItem(userId, id, { fetchState: "pending" });
    const item = await enrichItem(userId, id);
    return Response.json({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
