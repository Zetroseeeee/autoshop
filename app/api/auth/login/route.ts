import { NextResponse, type NextRequest } from "next/server";
import { createSession, normaliseEmail, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { authenticate } from "@/lib/users";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json({ error: "Too many attempts — wait a minute." }, { status: 429 });
    }
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = normaliseEmail(body.email);
    // Also throttle per account, so a distributed attacker cannot grind one inbox.
    if (email && !rateLimit(`login-email:${email}`, 10, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts for that account — wait a few minutes." }, { status: 429 });
    }
    const password = typeof body.password === "string" ? body.password : "";
    // Deliberately vague: never reveal whether the email exists.
    const invalid = NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    if (!email || !password) return invalid;

    const user = await authenticate(email, password);
    if (!user) return invalid;

    const session = await createSession(user.id);
    if (!session) return NextResponse.json({ error: "AUTH_SECRET is not configured on the server." }, { status: 500 });

    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
