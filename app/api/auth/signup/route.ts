import { NextResponse, type NextRequest } from "next/server";
import { createSession, normaliseEmail, passwordProblem, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { AuthError, createUser } from "@/lib/users";
import { errorResponse } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60_000)) {
      return NextResponse.json({ error: "Too many sign-ups from here — try again later." }, { status: 429 });
    }
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = normaliseEmail(body.email);
    if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    const pwProblem = passwordProblem(body.password);
    if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

    const user = await createUser(email, body.password as string);
    const session = await createSession(user.id);
    if (!session) return NextResponse.json({ error: "AUTH_SECRET is not configured on the server." }, { status: 500 });

    const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 409 });
    return errorResponse(err);
  }
}
