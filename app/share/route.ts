import { NextResponse, type NextRequest } from "next/server";
import { addFromParams, isCrossSiteRequest } from "@/lib/quickAdd";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** PWA share_target (GET). Session-protected by the proxy, so no token is needed. */
export async function GET(req: NextRequest) {
  // Share targets are opened by the OS/browser, never by another site's page.
  if (isCrossSiteRequest(req)) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin), 302);
  }
  const user = await currentUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  const p = req.nextUrl.searchParams;
  const item = await addFromParams(user.id, { url: p.get("url"), text: p.get("text"), title: p.get("title") });
  return NextResponse.redirect(new URL(item ? "/?notice=added" : "/?notice=nolink", req.nextUrl.origin), 302);
}
