/**
 * Single-user passcode auth. Runs in both the proxy and route handlers, so it
 * only uses Web Crypto (no Node-only imports).
 */
export const AUTH_COOKIE = "basket_auth";
export const AUTH_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** HMAC-SHA256 of a fixed message keyed by ACCESS_CODE — the cookie value. */
export async function authToken(): Promise<string | null> {
  const code = process.env.ACCESS_CODE;
  if (!code) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(code),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("basket_auth:v1"));
  return hex(sig);
}

/** True when the request cookie matches the current ACCESS_CODE. */
export async function isAuthed(cookieValue: string | undefined | null): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await authToken();
  if (!expected) return false;
  return safeEqual(cookieValue, expected);
}

/** True when a supplied passcode matches ACCESS_CODE (used by /unlock and /api/quick-add). */
export function codeMatches(code: string | null | undefined): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected || !code) return false;
  return safeEqual(code.trim(), expected);
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  };
}

/** Only allow same-origin relative paths as post-unlock redirect targets. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/unlock")) return "/";
  return next;
}
