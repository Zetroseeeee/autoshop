import type { NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { runPriceCheck } from "@/lib/priceCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron target (see vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`;
 * without CRON_SECRET configured the job refuses to run rather than being open to anyone.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const started = Date.now();
  const summary = await runPriceCheck();
  console.log("[price-check]", summary);
  return Response.json({ ...summary, ms: Date.now() - started });
}
