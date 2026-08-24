import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

/**
 * Session gate. Everything is protected except the auth screens, the
 * token-authenticated quick-add endpoint, the cron route (CRON_SECRET) and
 * PWA assets. Handlers re-check the session themselves — this is defence in
 * depth, not the only check.
 */
export async function proxy(req: NextRequest) {
  const userId = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|signup|api/auth/|api/quick-add|api/cron/|manifest\\.webmanifest|sw\\.js|icons/|icon\\.png|apple-icon\\.png|favicon\\.ico|_next/static|_next/image).*)",
  ],
};
