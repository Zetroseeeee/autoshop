import { NextResponse, type NextRequest } from "next/server";
import { codeMatches } from "@/lib/auth";
import { addFromParams, wantsJson } from "@/lib/quickAdd";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET or POST /api/quick-add?code=<ACCESS_CODE>&url=<link>
 * Authenticates with the code (for the iOS Shortcut), not the cookie.
 * Responds 302 → / for browsers, JSON when `Accept: application/json`.
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
  if (!rateLimit(`quick-add:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!codeMatches(params.code)) {
    return NextResponse.json({ error: "Unauthorised — bad or missing code" }, { status: 401 });
  }
  const item = await addFromParams(params);
  if (!item) {
    if (wantsJson(req)) return NextResponse.json({ error: "No link found in url/text/title" }, { status: 400 });
    return NextResponse.redirect(new URL("/?notice=nolink", req.nextUrl.origin), 302);
  }
  if (wantsJson(req)) return NextResponse.json({ item }, { status: 201 });
  return NextResponse.redirect(new URL("/?notice=added", req.nextUrl.origin), 302);
}
