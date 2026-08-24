/**
 * Multi-user auth.
 *
 * Split deliberately by runtime: session verification uses Web Crypto only, so
 * the proxy can check a cookie on every request. Password hashing uses Node's
 * scrypt and therefore only ever runs inside route handlers.
 */
export const SESSION_COOKIE = "basket_session";
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

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

/**
 * The signing secret. AUTH_SECRET is the real one; ACCESS_CODE is accepted as a
 * fallback so an existing single-user deployment keeps working after upgrading.
 * Missing entirely → sessions cannot be issued or verified (fail closed).
 */
function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.ACCESS_CODE || null;
}

async function sign(message: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

/** Cookie value: `<userId>.<expiryMs>.<hmac>`. Stateless, so logout-everywhere needs a secret rotation. */
export async function createSession(userId: string, now = Date.now()): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const expires = now + SESSION_MAX_AGE * 1000;
  const body = `${userId}.${expires}`;
  return `${body}.${await sign(body, key)}`;
}

/** Returns the userId when the cookie is authentic and unexpired, else null. */
export async function readSession(cookieValue: string | undefined | null, now = Date.now()): Promise<string | null> {
  const key = secret();
  if (!key || !cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, mac] = parts as [string, string, string];
  if (!userId || !/^\d+$/.test(expiresRaw)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now) return null;
  const expected = await sign(`${userId}.${expiresRaw}`, key);
  return safeEqual(mac, expected) ? userId : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

// ---- passwords (Node runtime only) -------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 64;

/** `scrypt$N$r$p$saltHex$hashHex` */
export async function hashPassword(password: string): Promise<string> {
  const { randomBytes, scrypt } = await import("node:crypto");
  const salt = randomBytes(16);
  const derived: Buffer = await new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p }, (err, dk) => (err ? reject(err) : resolve(dk))),
  );
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verify. Returns false for any malformed stored value. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scrypt, timingSafeEqual } = await import("node:crypto");
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts as [string, string, string, string, string, string];
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const derived: Buffer = await new Promise((resolve, reject) =>
      // maxmem must allow the stored cost parameters
      scrypt(password, salt, expected.length, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, dk) => (err ? reject(err) : resolve(dk))),
    );
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---- validation ---------------------------------------------------------------

export const MIN_PASSWORD_LENGTH = 8;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  // deliberately permissive: one @, no spaces, a dot in the domain
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordProblem(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return "Enter a password";
  if (raw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (raw.length > 200) return "Password is too long";
  return null;
}

/**
 * Only allow same-origin relative paths as post-login redirect targets.
 *
 * Prefix checks alone are not enough: browsers strip tabs and newlines from URLs,
 * so "/\t/evil.com" parses as "//evil.com" — a different origin. Resolve against a
 * sentinel origin and require the result to stay on it.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (/[\u0000-\u001F\u007F]/.test(next)) return "/";
  const SENTINEL = "http://basket.invalid";
  let resolved: URL;
  try {
    resolved = new URL(next, SENTINEL);
  } catch {
    return "/";
  }
  if (resolved.origin !== SENTINEL) return "/";
  const path = resolved.pathname + resolved.search;
  if (path.startsWith("/login") || path.startsWith("/signup")) return "/";
  return path;
}
