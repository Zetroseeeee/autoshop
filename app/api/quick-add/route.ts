import { NextResponse, type NextRequest } from "next/server";
import { addFromParams, isCrossSiteRequest, wantsJson } from "@/lib/quickAdd";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";
import { findUserByQuickAddToken } from "@/lib/users";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * GET or POST /api/quick-add?token=<your token>&url=<link>
 *
 * Authenticates with the user's personal quick-add token (this is what the iOS
 * Shortcut uses), or with an existing session cookie. `code=` is accepted as an
 * alias so Shortcuts built before accounts existed keep working.
 */
export async function GET(req: NextRequest) {
  return handle(req, Object.fromEntries(req.nextUrl.searchParams));
}

export async function POST(req: NextRequest) {
  const params: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams);
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(body)) if (typeof v === "string") params[k] = v;
    } else if (type.includes("form")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
    }
  } catch {
    /* ignore malformed bodies — fall through to validation */
  }
  return handle(req, params);
}

async function handle(req: NextRequest, params: Record<string, string>) {
  if (!rateLimit(`quick-add:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = (params.token ?? params.code ?? "").trim();
  // The token path is explicit and safe cross-site; the cookie path is not.
  if (!token && isCrossSiteRequest(req)) {
    return NextResponse.json({ error: "Unauthorised — supply your quick-add token" }, { status: 401 });
  }
  const user = token ? await findUserByQuickAddToken(token) : await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised — bad or missing token" }, { status: 401 });
  }

  const item = await addFromParams(user.id, params);
  if (!item) {
    if (wantsJson(req)) return NextResponse.json({ error: "No link found in url/text/title" }, { status: 400 });
    return NextResponse.redirect(new URL("/?notice=nolink", req.nextUrl.origin), 302);
  }
  if (wantsJson(req)) return NextResponse.json({ item }, { status: 201 });
  return NextResponse.redirect(new URL("/?notice=added", req.nextUrl.origin), 302);
}
