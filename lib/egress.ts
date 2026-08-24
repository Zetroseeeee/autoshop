import { isIP } from "node:net";

/**
 * Egress guard for user-supplied URLs.
 *
 * The scraper and the studio image downloader both fetch addresses a signed-in
 * user chose, and anyone can create an account — so without this a user could
 * point the server at `169.254.169.254`, `10.0.0.5` or any other host only the
 * server can reach, and read the result back out of their own basket.
 *
 * Hostnames are resolved and every candidate address is checked, redirects are
 * followed manually so each hop is re-checked (which also closes DNS rebinding
 * between the check and the connection, because we pin the verified address).
 */

export class BlockedAddressError extends Error {}

const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Hostname suffixes that never refer to a public host. */
const PRIVATE_SUFFIXES = [".internal", ".local", ".localhost", ".home.arpa", ".lan", ".intranet", ".corp", ".private"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** True for any address that is not globally routable. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const n = ipv4ToInt(ip);
    if (n == null) return true;
    const inRange = (cidr: string, bits: number) => {
      const base = ipv4ToInt(cidr);
      if (base == null) return false;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (n & mask) === (base & mask);
    };
    return (
      inRange("0.0.0.0", 8) ||        // "this" network
      inRange("10.0.0.0", 8) ||       // RFC1918
      inRange("100.64.0.0", 10) ||    // CGNAT
      inRange("127.0.0.0", 8) ||      // loopback
      inRange("169.254.0.0", 16) ||   // link-local (cloud metadata)
      inRange("172.16.0.0", 12) ||    // RFC1918
      inRange("192.0.0.0", 24) ||     // IETF protocol assignments
      inRange("192.0.2.0", 24) ||     // TEST-NET-1
      inRange("192.168.0.0", 16) ||   // RFC1918
      inRange("198.18.0.0", 15) ||    // benchmarking
      inRange("198.51.100.0", 24) ||  // TEST-NET-2
      inRange("203.0.113.0", 24) ||   // TEST-NET-3
      inRange("224.0.0.0", 4) ||      // multicast
      inRange("240.0.0.0", 4)         // reserved + broadcast
    );
  }
  if (family === 6) {
    const ip6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (ip6 === "::" || ip6 === "::1") return true;
    if (ip6.startsWith("fe80") || ip6.startsWith("fec0")) return true; // link/site-local
    if (/^f[cd]/.test(ip6)) return true;                               // unique local
    if (ip6.startsWith("ff")) return true;                             // multicast
    // IPv4-mapped / -compatible: check the embedded v4 address
    const mapped = ip6.match(/(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true; // not an IP literal
}

export interface VerifiedTarget {
  url: URL;
  /** the resolved public address the request must connect to */
  address: string;
  family: 4 | 6;
}

/** Resolves a URL's host and rejects it unless every resolved address is public. */
export async function verifyPublicUrl(raw: string | URL): Promise<VerifiedTarget> {
  let url: URL;
  try {
    url = raw instanceof URL ? raw : new URL(raw);
  } catch {
    throw new BlockedAddressError("That is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedAddressError("Only http and https links are supported");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new BlockedAddressError("That port is not allowed");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new BlockedAddressError("That address is not reachable");
  }

  // Literal address: check directly, no DNS.
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedAddressError("That address is not reachable");
    return { url, address: host, family: isIP(host) === 6 ? 6 : 4 };
  }

  const { lookup } = await import("node:dns/promises");
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new BlockedAddressError("That address could not be resolved");
  }
  if (!records.length) throw new BlockedAddressError("That address could not be resolved");
  // Every answer must be public — a single private answer means the name is unsafe.
  for (const r of records) if (isPrivateAddress(r.address)) throw new BlockedAddressError("That address is not reachable");
  const chosen = records[0]!;
  return { url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * fetch() that verifies the target on every hop. Redirects are handled here
 * rather than by undici so an allowed page cannot bounce us onto an internal one.
 */
export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxRedirects = opts.maxRedirects ?? 4;
  const deadline = Date.now() + timeoutMs;
  let current = input;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const target = await verifyPublicUrl(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new BlockedAddressError("Timed out");
    const res = await fetch(target.url, {
      headers: opts.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(remaining),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      void res.body?.cancel().catch(() => undefined);
      current = new URL(location, target.url).href;
      continue;
    }
    return res;
  }
  throw new BlockedAddressError("Too many redirects");
}
