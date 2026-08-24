import type { NextRequest } from "next/server";
import { deleteItem, updateItem } from "@/lib/items";
import { requireUser } from "@/lib/session";
import { errorResponse, parseItemPatch } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const patch = parseItemPatch(await req.json().catch(() => null));
    const item = await updateItem(auth.user.id, id, patch);
    if (!item) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ item });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const ok = await deleteItem(auth.user.id, id);
    if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
