/**
 * Tiny in-memory sliding-window rate limiter. Good enough for a single-user app:
 * it protects /unlock and /api/quick-add from casual brute force. State is per
 * server instance (resets on cold start), which is the accepted trade-off.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    // crude GC so the map can't grow unbounded
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return true;
}

/**
 * The caller's address, for rate-limit bucketing.
 *
 * `x-forwarded-for` is client-supplied and its leftmost entry is trivially
 * spoofed, so a rotating header would hand out a fresh bucket per request.
 * Prefer the header the platform sets itself; otherwise take the RIGHTMOST
 * forwarded entry, which is the one appended by the proxy closest to us.
 */
export function clientIp(req: Request): string {
  const trusted = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  if (trusted) return trusted.split(",")[0]!.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return req.headers.get("x-real-ip") ?? "local";
}
