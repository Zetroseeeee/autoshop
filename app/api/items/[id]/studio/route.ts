import type { NextRequest } from "next/server";
import { generateStudio, StudioError } from "@/lib/studio";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generate / regenerate the studio packshot. Friendly refusals come back as 200 + message. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  try {
    const { id } = await ctx.params;
    const outcome = await generateStudio(id);
    return Response.json(outcome);
  } catch (err) {
    if (err instanceof StudioError) return Response.json({ error: err.message }, { status: err.message === "Item not found" ? 404 : 502 });
    return errorResponse(err);
  }
}
