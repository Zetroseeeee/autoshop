import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { decodeHTML } from "entities";
import { currencyFromText, isValidCurrency, parseAmount, saneAmount } from "./money";

/**
 * Product page parser (spec §6, Tier 1). Pure: HTML in, fields out. Used by every
 * tier, so it must never invent data — a field is either found or undefined.
 */
export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export interface Parsed {
  name?: string;
  brand?: string;
  priceMinor?: number;
  currency?: string;
  imageUrl?: string;
  /** availability, when the page states it; absent means "no signal", never a guess */
  availability?: Availability;
  /** e-commerce platform, when confidently detected (currently only Shopify) */
  platform?: "shopify";
  /** platform variant id — what an add-to-cart deep link needs */
  variantId?: string;
  /** the page is a bot-wall / challenge page: treat as "nothing useful" */
  botWall: boolean;
  /** the page looks like an empty client-rendered shell */
  appShell: boolean;
  /** which rule produced which field — for logs and tests */
  sources: Record<string, string>;
}

export interface ParseOptions {
  /** HTTP status of the response, when known */
  status?: number;
}

type Json = Record<string, unknown>;

const WALL_TITLE_RE =
  /access denied|just a moment|attention required|are you a (human|robot)|pardon our interruption|robot or human|verify (that )?you are|error page|security check|bot detection|unusual traffic|request (was )?blocked|403 forbidden|please enable (cookies|javascript)|one more step|human verification|checking your browser|blocked|denied/i;
/* Signatures of actual challenge pages. Passive beacons that also appear on normal pages
   (Cloudflare's /cdn-cgi/challenge-platform/scripts/jsd, DataDome's dd.js) are deliberately absent. */
const WALL_MARKUP_RE =
  /cf-browser-verification|cf-challenge-running|cf_chl_opt|\/cdn-cgi\/challenge-platform\/h\/|_Incapsula_Resource|distil_r_captcha|px-captcha|akam-logo|triggerInterstitialChallenge|sec-cpt-if|geo\.captcha-delivery\.com\/captcha|captcha-delivery\.com\/captcha|hcaptcha\.com\/1\/api|ddm-captcha|\/_sec\/cp_challenge|id="challenge-form"|challenge-error-text/i;

/* Image URL hygiene — applied to path segments, never to the whole URL, so a product slug like
   "overshirt-with-badge" or "icon-logo-jumper" is not mistaken for a site badge/logo. */
const BAD_IMAGE_DIR_RE = /^(logos?|icons?|badges?|sprites?|flags?|favicons?|placeholders?|payments?|payment-?(icons?|logos?)|brand-?assets?|social|share)$/i;
const BAD_IMAGE_FILE_TOKEN_RE =
  /^(favicon|sprite|sprites|placeholder|blank|pixel|spacer|loading|loader|trustpilot|klarna|clearpay|afterpay|paypal|mastercard|visa|amex|applepay|googlepay|og-default|default-og|share-image|social-share)$/i;
const BAD_IMAGE_FILE_RE = /^(logo|icon|badge|flag)s?([-_][a-z0-9]+)?$/i;

export function parseProductHtml(html: string, pageUrl: string, opts: ParseOptions = {}): Parsed {
  const out: Parsed = { botWall: false, appShell: false, sources: {} };
  if (!html || html.length < 40) {
    out.botWall = (opts.status ?? 200) >= 400;
    return out;
  }
  const $ = cheerio.load(html);
  const host = hostOf(pageUrl);
  const title = cleanText($("head > title").first().text() || $("title").first().text());
  const visibleText = visibleTextOf($);

  // ---- bot wall / challenge detection ------------------------------------
  const status = opts.status ?? 200;
  const hasWallMarkup = WALL_MARKUP_RE.test(html);
  const hasWallTitle = WALL_TITLE_RE.test(title) || title === "" || title === " ";
  if (
    (hasWallMarkup && visibleText.length < 3000) ||
    (hasWallTitle && visibleText.length < 1500) ||
    (status === 403 || status === 429 || status === 503) && visibleText.length < 1500
  ) {
    out.botWall = true;
    out.sources.botWall = hasWallMarkup ? "markup" : hasWallTitle ? `title:${title.slice(0, 40)}` : `status:${status}`;
    return out;
  }

  // ---- 1. JSON-LD ---------------------------------------------------------
  const product = findJsonLdProduct($);
  if (product) {
    const name = cleanName(asString(product.name), host);
    if (name) set(out, "name", name, "jsonld");
    const brand = brandName(product.brand);
    if (brand) set(out, "brand", brand, "jsonld");
    const image = absolutise(pickImage(product.image), pageUrl, { declared: true });
    if (image) set(out, "imageUrl", image, "jsonld");
    const price = priceFromOffers(product.offers);
    if (price) applyPrice(out, price.amount, price.currency, "jsonld");
  }

  // ---- 1b. Availability ---------------------------------------------------
  if (product) {
    const avail = availabilityFromOffers(product.offers);
    if (avail) {
      out.availability = avail;
      out.sources.availability = "jsonld";
    }
  }
  if (!out.availability) {
    const metaAvail =
      $('meta[property="product:availability"]').first().attr("content") ??
      $('meta[property="og:availability"]').first().attr("content") ??
      $('[itemprop="availability"]').first().attr("href") ??
      $('[itemprop="availability"]').first().attr("content");
    const mapped = mapAvailability(metaAvail);
    if (mapped) {
      out.availability = mapped;
      out.sources.availability = "meta";
    }
  }

  if (!out.availability) {
    const storeAvail = storeAvailability(html, pageUrl);
    if (storeAvail) {
      out.availability = storeAvail.availability;
      out.sources.availability = storeAvail.source;
    }
  }

  // ---- 1c. Platform / variant (for add-to-cart deep links) ------------------
  const shopify = detectShopify(html, $, pageUrl);
  if (shopify) {
    out.platform = "shopify";
    if (shopify.variantId) {
      out.variantId = shopify.variantId;
      out.sources.variantId = shopify.source;
    }
  }

  // ---- 2. Meta tags -------------------------------------------------------
  const meta = (sel: string) => $(sel).first().attr("content")?.trim() || undefined;
  if (!out.name) {
    const og = cleanName(meta('meta[property="og:title"]') ?? meta('meta[name="og:title"]'), host);
    if (og) set(out, "name", og, "og:title");
  }
  if (!out.imageUrl) {
    const candidates = [
      ["og:image:secure_url", meta('meta[property="og:image:secure_url"]')],
      ["og:image", meta('meta[property="og:image"]') ?? meta('meta[name="og:image"]')],
      ["twitter:image", meta('meta[name="twitter:image"]') ?? meta('meta[property="twitter:image"]')],
      ["twitter:image:src", meta('meta[name="twitter:image:src"]')],
      ["link:image_src", $('link[rel="image_src"]').first().attr("href")],
    ] as const;
    for (const [src, val] of candidates) {
      const abs = absolutise(val, pageUrl);
      if (abs) {
        set(out, "imageUrl", abs, src);
        break;
      }
    }
  }
  if (out.priceMinor == null) {
    const pairs = [
      ["product:price:amount", meta('meta[property="product:price:amount"]'), meta('meta[property="product:price:currency"]')],
      ["og:price:amount", meta('meta[property="og:price:amount"]'), meta('meta[property="og:price:currency"]')],
      ["twitter:data1", twitterPrice($), undefined],
      ["meta[itemprop=price]", meta('meta[itemprop="price"]'), meta('meta[itemprop="priceCurrency"]')],
    ] as const;
    for (const [src, amountText, currencyText] of pairs) {
      if (!amountText) continue;
      const amount = parseAmount(amountText);
      const currency = normaliseCurrency(currencyText) ?? currencyFromText(amountText);
      if (applyPrice(out, amount, currency, src)) break;
    }
  }

  // ---- 3. [itemprop=price] ------------------------------------------------
  if (out.priceMinor == null) {
    const el = $('[itemprop="price"]').first();
    if (el.length) {
      const text = el.attr("content") ?? el.text();
      const currency =
        normaliseCurrency($('[itemprop="priceCurrency"]').first().attr("content") ?? $('[itemprop="priceCurrency"]').first().text()) ??
        currencyFromText(text);
      applyPrice(out, parseAmount(text), currency, "itemprop");
    }
  }

  // ---- 4. <title> as last-resort name -------------------------------------
  if (!out.name) {
    const t = cleanName(title, host);
    if (t) set(out, "name", t, "title");
  }

  // ---- 5. Embedded JSON state (ASOS, Uniqlo, …) -----------------------------
  if (out.priceMinor == null) {
    const p = embeddedPrice(html, pageUrl);
    if (p) applyPrice(out, p.amount, p.currency, `embedded:${p.source}`);
  }

  // ---- 6. Visible price element (rendered pages) ----------------------------
  if (out.priceMinor == null) {
    const p = domPrice($);
    if (p) applyPrice(out, p.amount, p.currency, "dom");
  }

  // ---- app shell detection -------------------------------------------------
  const nothing = !out.name && out.priceMinor == null && !out.imageUrl;
  const emptyRoot = $("#root, #__next, #app, app-root, #___gatsby, #__nuxt")
    .toArray()
    .some((el) => cleanText($(el).text()).length < 40);
  if ((nothing || out.priceMinor == null) && (emptyRoot || (visibleText.length < 600 && $("script").length >= 3))) {
    out.appShell = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// helpers

function set(out: Parsed, key: "name" | "brand" | "imageUrl", value: string, source: string) {
  out[key] = value;
  out.sources[key] = source;
}

function applyPrice(out: Parsed, amount: number | null | undefined, currency: string | null | undefined, source: string): boolean {
  if (!saneAmount(amount)) return false;
  out.priceMinor = Math.round(amount * 100);
  out.sources.price = source;
  const cur = normaliseCurrency(currency);
  if (cur) {
    out.currency = cur;
    out.sources.currency = source;
  }
  return true;
}

function normaliseCurrency(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  if (isValidCurrency(c)) return c;
  return currencyFromText(code) ?? undefined;
}

export function cleanText(s: string | null | undefined): string {
  if (!s) return "";
  return decodeHTML(s).replace(/\s+/g, " ").trim();
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  if (v && typeof v === "object" && typeof (v as Json)["@value"] === "string") return (v as Json)["@value"] as string;
  return undefined;
}

/** Strip " | ASOS", " - Vinted", " | UNIQLO UK" style site suffixes and tidy whitespace. */
export function cleanName(raw: string | undefined, host: string): string | undefined {
  let name = cleanText(raw);
  if (!name) return undefined;
  const labels = host
    .replace(/^www\./, "")
    .split(".")
    .filter((l) => l.length > 2 && !/^(com|co|uk|net|org|shop|store|eu|de|fr|it|es|nl|io|app)$/.test(l));
  const parts = name.split(/\s+[|–—·•-]\s+|\s+\|\s*/);
  while (parts.length > 1) {
    const last = parts[parts.length - 1]!;
    const norm = last.toLowerCase().replace(/[^a-z0-9]/g, "");
    const siteish =
      (norm.length > 0 && norm.length <= 30 && labels.some((l) => l.includes(norm) || norm.includes(l))) ||
      /^(official (site|store|online store)|online shop|shop online|buy online|free (uk )?delivery.*)$/i.test(last);
    if (!siteish) break;
    parts.pop();
  }
  name = parts.join(" - ").replace(/\s+/g, " ").trim();
  return name || undefined;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function visibleTextOf($: CheerioAPI): string {
  const clone = $("body").clone();
  clone.find("script, style, noscript, svg, template").remove();
  return cleanText(clone.text());
}

// ---- JSON-LD ---------------------------------------------------------------

function* walkJson(node: unknown, depth = 0): Generator<Json> {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walkJson(n, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Json;
  yield obj;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item", "hasVariant", "isVariantOf", "subjectOf"]) {
    if (key in obj) yield* walkJson(obj[key], depth + 1);
  }
}

function typeTokens(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.filter((t): t is string => typeof t === "string");
  return [];
}

function isProductType(node: Json): boolean {
  return typeTokens(node["@type"]).some((t) => /(^|\/|:)(Product|ProductGroup|IndividualProduct|ProductModel|Vehicle)$/.test(t));
}

function findJsonLdProduct($: CheerioAPI): Json | undefined {
  const candidates: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    const json = parseJsonLoose(raw);
    if (json == null) return;
    for (const node of walkJson(json)) if (isProductType(node)) candidates.push(node);
  });
  if (!candidates.length) return undefined;
  // Prefer a node with a name and some offer/image; merge a ProductGroup with its first variant.
  candidates.sort((a, b) => score(b) - score(a));
  const best = candidates[0]!;
  if (!best.offers && Array.isArray(best.hasVariant) && best.hasVariant.length) {
    const variant = best.hasVariant.find((v) => v && typeof v === "object") as Json | undefined;
    if (variant) return { ...variant, ...best, offers: variant.offers ?? best.offers, image: best.image ?? variant.image };
  }
  return best;
}

function score(n: Json): number {
  return (n.name ? 4 : 0) + (n.offers ? 2 : 0) + (n.image ? 1 : 0) + (typeTokens(n["@type"]).includes("Product") ? 1 : 0);
}

function parseJsonLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    /* tolerate HTML comments / CDATA wrappers and trailing commas */
    const cleaned = raw
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .replace(/^\s*\/\/<!\[CDATA\[/, "")
      .replace(/\/\/\]\]>\s*$/, "")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function brandName(v: unknown): string | undefined {
  if (typeof v === "string") return cleanText(v) || undefined;
  if (Array.isArray(v)) return brandName(v[0]);
  if (v && typeof v === "object") return brandName((v as Json).name);
  return undefined;
}

interface ImageCandidate {
  url: string;
  area: number;
}

function imageCandidates(v: unknown, depth = 0): ImageCandidate[] {
  if (v == null || depth > 3) return [];
  if (typeof v === "string") return [{ url: v, area: 0 }];
  if (Array.isArray(v)) return v.flatMap((x) => imageCandidates(x, depth + 1));
  if (typeof v === "object") {
    const o = v as Json;
    const url = asString(o.url) ?? asString(o.contentUrl) ?? asString(o["@id"]);
    const w = Number(asString(o.width) ?? o.width) || 0;
    const h = Number(asString(o.height) ?? o.height) || 0;
    return url ? [{ url, area: w * h }] : [];
  }
  return [];
}

/** First image, unless sizes are declared — then the largest. */
function pickImage(v: unknown): string | undefined {
  const cands = imageCandidates(v).filter((c) => /^(https?:)?\/\/|^\//.test(c.url.trim()));
  if (!cands.length) return undefined;
  const sized = cands.filter((c) => c.area > 0);
  if (sized.length) return sized.sort((a, b) => b.area - a.area)[0]!.url;
  return cands[0]!.url;
}

interface FoundPrice {
  amount: number;
  currency?: string;
}

/**
 * Availability signals that only exist in a particular store's own markup.
 * Each rule is anchored on something specific to that page — never a bare word
 * like "Sold", which appears in every Vinted page's inlined i18n dictionary.
 */
function storeAvailability(html: string, pageUrl: string): { availability: Availability; source: string } | undefined {
  const host = hostOf(pageUrl);

  // Vinted: a sold listing still returns 200 with a price, so it would otherwise
  // look identical to a live one. The RSC flight payload carries can_buy.
  if (/(^|\.)vinted\./.test(host)) {
    const flight = rscFlightPayload(html);
    if (flight) {
      if (/"can_buy"\s*:\s*false/.test(flight)) return { availability: "out_of_stock", source: "vinted:can_buy" };
      if (/"can_buy"\s*:\s*true/.test(flight)) return { availability: "in_stock", source: "vinted:can_buy" };
    }
  }

  // ASOS: JSON-LD offers is empty; stock lives in the embedded stockPriceResponse
  // array, which also covers recommended products — anchor on this product's id.
  if (/(^|\.)asos\./.test(host)) {
    const id = pageUrl.match(/\/prd\/(\d+)/)?.[1];
    if (id) {
      let anchor = html.indexOf(`"productId":${id}`);
      if (anchor < 0) anchor = html.indexOf(`"id":${id}`);
      if (anchor >= 0) {
        const slice = html.slice(anchor, anchor + 1200);
        const inStock = slice.match(/"isInStock"\s*:\s*(true|false)/)?.[1];
        if (inStock === "false") return { availability: "out_of_stock", source: "asos:isInStock" };
        if (inStock === "true") {
          const low = /"isLowInStock"\s*:\s*true/.test(slice);
          return { availability: low ? "low_stock" : "in_stock", source: "asos:isInStock" };
        }
      }
    }
  }
  return undefined;
}

/** Concatenated Next.js RSC flight payload (self.__next_f.push([1,"…"])). */
function rscFlightPayload(html: string): string | undefined {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      out += JSON.parse(m[1]!) as string;
    } catch {
      /* skip malformed chunk */
    }
  }
  return out || undefined;
}

/**
 * Shopify detection + variant id, which together enable a real add-to-cart link.
 * The variant id comes from the JSON-LD offer URL (`?variant=…`) — the one place
 * it appears reliably, since theme markup varies far too much to depend on.
 */
function detectShopify(html: string, $: CheerioAPI, pageUrl: string): { variantId?: string; source: string } | undefined {
  const isShopify =
    /Shopify\.shop\s*=/.test(html) ||
    /\/cdn\/shop\/(files|products)/.test(html) ||
    Boolean($("script#shopify-features").length);
  if (!isShopify) return undefined;
  let path: string;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    return undefined;
  }
  if (!path.includes("/products/")) return { source: "shopify:detected" };

  // Prefer a variant that is actually in stock — a permalink does not enforce it.
  const offers: Array<{ id: string; available: boolean }> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const json = parseJsonLoose($(el).contents().text().trim());
    if (json == null) return;
    for (const node of walkJson(json)) {
      if (!isProductType(node)) continue;
      const list = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
      for (const raw of list) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Json;
        const id = asString(o.url)?.match(/[?&]variant=(\d+)/)?.[1];
        if (!id) continue;
        offers.push({ id, available: mapAvailability(asString(o.availability)) !== "out_of_stock" });
      }
    }
  });
  const chosen = offers.find((o) => o.available) ?? offers[0];
  return chosen ? { variantId: chosen.id, source: "shopify:jsonld" } : { source: "shopify:detected" };
}

/**
 * schema.org availability → our three states. Anything unrecognised returns
 * undefined so the caller records "unknown" rather than inventing a state.
 */
export function mapAvailability(raw: unknown): Availability | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase().replace(/^https?:\/\/schema\.org\//, "").replace(/[\s_-]/g, "");
  if (["instock", "onlineonly", "instoreonly", "preorder", "presale", "backorder"].includes(v)) return "in_stock";
  if (["limitedavailability", "lowstock"].includes(v)) return "low_stock";
  if (["outofstock", "soldout", "discontinued"].includes(v)) return "out_of_stock";
  return undefined;
}

/** Availability from an offers object/array/AggregateOffer. */
function availabilityFromOffers(offers: unknown, depth = 0): Availability | undefined {
  if (!offers || depth > 3) return undefined;
  const list = Array.isArray(offers) ? offers : [offers];
  let sawOut = false;
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Json;
    const direct = mapAvailability(asString(o.availability) ?? asString((o.availability as Json | undefined)?.["@id"]));
    if (direct === "in_stock" || direct === "low_stock") return direct;
    if (direct === "out_of_stock") sawOut = true;
    const nested = availabilityFromOffers(o.offers, depth + 1);
    if (nested === "in_stock" || nested === "low_stock") return nested;
    if (nested === "out_of_stock") sawOut = true;
  }
  return sawOut ? "out_of_stock" : undefined;
}

function priceFromOffers(offers: unknown): FoundPrice | undefined {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Json;
    const types = typeTokens(o["@type"]);
    const currency = normaliseCurrency(asString(o.priceCurrency));
    if (types.includes("AggregateOffer") || o.lowPrice != null) {
      for (const key of ["lowPrice", "price", "highPrice"]) {
        const amount = parseAmount(asString(o[key]) ?? (typeof o[key] === "number" ? (o[key] as number) : undefined));
        if (saneAmount(amount)) return { amount, currency };
      }
      const nested = priceFromOffers(o.offers);
      if (nested) return nested;
      continue;
    }
    const direct = parseAmount(asString(o.price) ?? (typeof o.price === "number" ? (o.price as number) : undefined));
    if (saneAmount(direct)) return { amount: direct, currency };
    const specs = Array.isArray(o.priceSpecification) ? o.priceSpecification : o.priceSpecification ? [o.priceSpecification] : [];
    for (const s of specs) {
      if (!s || typeof s !== "object") continue;
      const spec = s as Json;
      const amount = parseAmount(asString(spec.price) ?? (typeof spec.price === "number" ? (spec.price as number) : undefined));
      if (saneAmount(amount)) return { amount, currency: normaliseCurrency(asString(spec.priceCurrency)) ?? currency };
    }
  }
  return undefined;
}

// ---- meta / dom helpers ------------------------------------------------------

function twitterPrice($: CheerioAPI): string | undefined {
  for (const i of [1, 2]) {
    const label = $(`meta[name="twitter:label${i}"]`).attr("content") ?? "";
    if (/price/i.test(label)) {
      const data = $(`meta[name="twitter:data${i}"]`).attr("content");
      if (data) return data;
    }
  }
  return undefined;
}

export function absolutise(src: string | undefined | null, pageUrl: string, opts: { declared?: boolean } = {}): string | undefined {
  if (!src) return undefined;
  let s = decodeHTML(src.trim());
  if (!s || s.startsWith("data:") || s.startsWith("blob:")) return undefined;
  if (s.startsWith("//")) s = `https:${s}`;
  let url: URL;
  try {
    url = new URL(s, pageUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (!isLikelyProductImage(url.href, opts)) return undefined;
  return url.href;
}

/**
 * Reject images that are obviously not product shots: vector/animated/icon formats,
 * anything living in a logos/icons/badges/sprites directory, or files named like a
 * logo/icon/badge/payment mark. A JSON-LD `image` is a declared product image, so
 * for those only the format and directory rules apply.
 */
export function isLikelyProductImage(url: string, opts: { declared?: boolean } = {}): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  if (/\.(svg|gif|ico)$/i.test(pathname)) return false;
  const segments = pathname.split("/").filter(Boolean);
  const file = segments.pop() ?? "";
  if (segments.some((seg) => BAD_IMAGE_DIR_RE.test(seg))) return false;
  if (/^favicon/i.test(file)) return false;
  if (opts.declared) return true;
  const stem = file.replace(/\.[a-z0-9]+$/i, "");
  if (BAD_IMAGE_FILE_RE.test(stem)) return false;
  if (stem.split(/[-_.]/).some((t) => BAD_IMAGE_FILE_TOKEN_RE.test(t))) return false;
  return true;
}

const EMBEDDED_PATTERNS: Array<{ source: string; re: RegExp; pick: (m: RegExpMatchArray, html: string, pageUrl?: string) => FoundPrice | undefined }> = [
  {
    // ASOS embeds a stockPriceResponse array covering the page product AND the
    // recommendation carousel, so the first "current" block in the document is
    // often a different, cheaper product. Anchor on the productId in the URL.
    source: "asos",
    re: /"current":\{"value":(\d+(?:\.\d+)?),"text":"([^"]*)"/,
    pick: (m, html, pageUrl) => {
      const wanted = pageUrl?.match(/\/prd\/(\d+)/)?.[1];
      let slice = html;
      let offset = m.index ?? 0;
      if (wanted) {
        let anchor = html.indexOf(`"productId":${wanted}`);
        if (anchor < 0) anchor = html.indexOf(`"id":${wanted}`);
        if (anchor < 0) return undefined; // cannot prove which product this price belongs to
        slice = html.slice(anchor, anchor + 1200);
        const own = slice.match(/"current":\{"value":(\d+(?:\.\d+)?),"text":"([^"]*)"/);
        if (!own) return undefined;
        const cur = slice.match(/"currency":"([A-Z]{3})"/)?.[1] ?? currencyFromText(decodeJsonString(own[2] ?? "")) ?? undefined;
        return { amount: Number(own[1]), currency: cur };
      }
      const after = html.slice(offset, offset + 800);
      const cur = after.match(/"currency":"([A-Z]{3})"/)?.[1] ?? currencyFromText(decodeJsonString(m[2] ?? "")) ?? undefined;
      return { amount: Number(m[1]), currency: cur };
    },
  },
  {
    // Uniqlo: "prices":{"base":{"currency":{"code":"GBP","symbol":"£"},"value":22.9}
    source: "uniqlo",
    re: /"prices":\{"base":\{"currency":\{"code":"([A-Z]{3})"[^}]*\},"value":(\d+(?:\.\d+)?)/,
    pick: (m) => ({ amount: Number(m[2]), currency: m[1] }),
  },
  {
    // generic "price":"45.00" / "price":45.00 with a priceCurrency/currency key nearby
    source: "generic",
    re: /"price":\s*"?(\d{1,6}\.\d{1,2})"?[^{}]{0,160}?"(?:priceCurrency|currencyCode|currency)":\s*"([A-Z]{3})"/,
    pick: (m) => ({ amount: Number(m[1]), currency: m[2] }),
  },
];

function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
}

/** Price from JSON state embedded in scripts — conservative, known shapes only. */
export function embeddedPrice(html: string, pageUrl?: string): (FoundPrice & { source: string }) | undefined {
  for (const p of EMBEDDED_PATTERNS) {
    const m = html.match(p.re);
    if (!m) continue;
    const found = p.pick(m, html, pageUrl);
    if (found && saneAmount(found.amount)) return { ...found, source: p.source };
  }
  return undefined;
}

const PRICE_TEXT_RE = /(?:£|€|\$|US\$|CA\$|A\$|¥|\b(?:GBP|EUR|USD)\b)\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*(?:[.,]\d{2})?\s?(?:£|€|\$|\b(?:GBP|EUR|USD)\b)/;
const NOT_CURRENT_RE = /was|old|rrp|previous|strike|original|compare|save|saving|discount|off\b|per[-_ ]|unit|delivery|shipping|total|from|installment|instalment|klarna|clearpay|afterpay|month|credit|min|max|range|filter|sort/i;

/** Visible "current price" element on a rendered page (generic, last resort). */
export function domPrice($: CheerioAPI): FoundPrice | undefined {
  const els = $('[class*="price" i], [data-testid*="price" i], [id*="price" i], [data-test*="price" i], [itemprop="offers"]').toArray();
  for (const el of els) {
    const $el = $(el);
    const attrs = `${$el.attr("class") ?? ""} ${$el.attr("data-testid") ?? ""} ${$el.attr("id") ?? ""} ${$el.attr("data-test") ?? ""}`;
    if (NOT_CURRENT_RE.test(attrs)) continue;
    if ($el.closest("s, del, strike, [class*='was' i], [class*='old' i], [class*='rrp' i]").length) continue;
    const text = cleanText($el.text()).slice(0, 80);
    const m = text.match(PRICE_TEXT_RE);
    if (!m) continue;
    const amount = parseAmount(m[0]);
    if (!saneAmount(amount)) continue;
    return { amount, currency: currencyFromText(m[0]) ?? undefined };
  }
  return undefined;
}

/** ok = name + price + image; partial = some; failed = nothing useful. */
export function classify(p: Pick<Parsed, "name" | "priceMinor" | "imageUrl">): "ok" | "partial" | "failed" {
  const has = [Boolean(p.name), p.priceMinor != null, Boolean(p.imageUrl)];
  if (has.every(Boolean)) return "ok";
  if (has.some(Boolean)) return "partial";
  return "failed";
}
