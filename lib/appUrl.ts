import { headers } from "next/headers";

/**
 * The app's own public origin, used for the iOS Shortcut instructions.
 *
 * APP_URL is honoured when set, but it is easy to leave pointing at localhost
 * after a deploy — which silently produces a Shortcut that cannot reach the app.
 * So we fall back to the origin the page was actually requested on (and to
 * Vercel's own VERCEL_PROJECT_PRODUCTION_URL), which is right by construction.
 */
export async function resolveAppUrl(): Promise<string> {
  const configured = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* headers() unavailable (static render) — fall through */
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return configured;
}
