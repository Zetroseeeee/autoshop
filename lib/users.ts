import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./auth";
import { db } from "./db";
import { users, type PublicUser, type User } from "./schema";

export class AuthError extends Error {}

const publicFields = {
  id: users.id,
  email: users.email,
  quickAddToken: users.quickAddToken,
  createdAt: users.createdAt,
};

export async function findUserById(id: string): Promise<PublicUser | null> {
  const [row] = await db.select(publicFields).from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function findUserByQuickAddToken(token: string): Promise<PublicUser | null> {
  if (!token) return null;
  const [row] = await db.select(publicFields).from(users).where(eq(users.quickAddToken, token)).limit(1);
  return row ?? null;
}

/** Creates an account. New accounts own nothing — the basket starts empty by construction. */
export async function createUser(email: string, password: string): Promise<PublicUser> {
  const passwordHash = await hashPassword(password);
  try {
    const [row] = await db.insert(users).values({ email, passwordHash }).returning(publicFields);
    if (!row) throw new AuthError("Could not create that account");
    return row;
  } catch (err) {
    // Postgres unique violation. Drizzle wraps driver errors, so walk the cause chain.
    if (isUniqueViolation(err)) throw new AuthError("An account with that email already exists");
    throw err;
  }
}

/** Verifies credentials. Always runs a hash comparison so timing does not reveal whether the email exists. */
export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const user = await findUserByEmail(email);
  const stored = user?.passwordHash ?? "scrypt$16384$8$1$00$00";
  const ok = await verifyPassword(password, stored);
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, quickAddToken: user.quickAddToken, createdAt: user.createdAt };
}

/** True for a Postgres 23505 unique_violation anywhere in the error chain. */
function isUniqueViolation(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 4) return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === "23505") return true;
  return isUniqueViolation(e.cause, depth + 1);
}

export async function rotateQuickAddToken(userId: string): Promise<string | null> {
  const { createId } = await import("@paralleldrive/cuid2");
  const token = createId() + createId();
  const [row] = await db.update(users).set({ quickAddToken: token }).where(eq(users.id, userId)).returning({ t: users.quickAddToken });
  return row?.t ?? null;
}
