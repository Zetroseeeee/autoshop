import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authCookieOptions, authToken, codeMatches } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_CODE) {
    return NextResponse.json({ error: "ACCESS_CODE is not configured on the server." }, { status: 500 });
  }
  if (!rateLimit(`unlock:${clientIp(req)}`, 8, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — wait a minute." }, { status: 429 });
  }
  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    /* fallthrough → 401 */
  }
  if (!codeMatches(code)) {
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }
  const token = await authToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token!, authCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
  return res;
}
