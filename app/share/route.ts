import { NextResponse, type NextRequest } from "next/server";
import { addFromParams } from "@/lib/quickAdd";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** PWA share_target (GET). Cookie-protected by the proxy, so no code is needed. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const item = await addFromParams({ url: p.get("url"), text: p.get("text"), title: p.get("title") });
  return NextResponse.redirect(new URL(item ? "/?notice=added" : "/?notice=nolink", req.nextUrl.origin), 302);
}
