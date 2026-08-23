import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthed } from "@/lib/auth";

/**
 * Passcode gate. Everything is protected except /unlock, /api/quick-add (which
 * authenticates with ?code=), the cron route (CRON_SECRET), and PWA assets.
 */
export async function proxy(req: NextRequest) {
  if (await isAuthed(req.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!unlock|api/unlock|api/quick-add|api/cron/|manifest\\.webmanifest|sw\\.js|icons/|icon\\.png|apple-icon\\.png|favicon\\.ico|_next/static|_next/image).*)",
  ],
};
