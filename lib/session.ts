import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "./auth";
import { findUserById } from "./users";
import type { PublicUser } from "./schema";

/**
 * Server-side session access for pages and route handlers.
 * The proxy already rejects unauthenticated traffic, but every handler
 * re-checks: a proxy matcher change must never silently expose data.
 */
export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const userId = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  return findUserById(userId);
}

/** For route handlers: the user, or a 401 Response to return immediately. */
export async function requireUser(): Promise<{ user: PublicUser } | { response: Response }> {
  const user = await currentUser();
  if (!user) return { response: Response.json({ error: "Unauthorised" }, { status: 401 }) };
  return { user };
}
