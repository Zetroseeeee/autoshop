import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAmount, parsePriceInput } from "../lib/money";
import { classify, cleanName, isLikelyProductImage, parseProductHtml } from "../lib/parse";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("parseProductHtml — JSON-LD site (END.)", () => {
  const p = parseProductHtml(fixture("jsonld-product.html"), "https://www.endclothing.com/gb/salomon-xt-6-sneaker-l49306600.html");

  it("takes name, brand, image and price from the @graph Product node", () => {
    expect(p.name).toBe("Salomon XT-6 Sneaker & Laces"); // entities decoded
    expect(p.brand).toBe("Salomon");
    expect(p.imageUrl).toBe("https://media.example-store.com/media/catalog/product/e/n/end-2026-1x1_l49306600_1.jpg");
    expect(p.priceMinor).toBe(16500);
    expect(p.currency).toBe("GBP");
    expect(p.sources.name).toBe("jsonld");
    expect(p.sources.price).toBe("jsonld");
  });

  it("is not fooled by Cloudflare's passive jsd beacon or SVG <title> elements", () => {
    expect(p.botWall).toBe(false);
    expect(p.name).not.toMatch(/Path/);
    expect(classify(p)).toBe("ok");
  });
});

describe("parseProductHtml — og-tags-only site (Uniqlo)", () => {
  const p = parseProductHtml(fixture("og-only.html"), "https://www.uniqlo.com/uk/en/products/E465193-000/00");

  it("uses og:title with the site suffix stripped", () => {
    expect(p.name).toBe("Unisex AIRism Cotton Crew Neck T-Shirt (Long Sleeve)");
    expect(p.sources.name).toBe("og:title");
  });

  it("uses og:image and product:price meta", () => {
    expect(p.imageUrl).toBe("https://image.uniqlo.com/UQ/ST3/gb/imagesgoods/465193/item/gbgoods_30_465193_3x4.jpg");
    expect(p.priceMinor).toBe(2290);
    expect(p.currency).toBe("GBP");
    expect(p.brand).toBeUndefined();
    expect(classify(p)).toBe("ok");
  });
});

describe("parseProductHtml — AggregateOffer + sized image array", () => {
  const p = parseProductHtml(fixture("aggregate-offer.html"), "https://sneaker-store.example/p/air-max-90");

  it("takes lowPrice with thousands separators, in the offer's currency", () => {
    expect(p.priceMinor).toBe(129900);
    expect(p.currency).toBe("USD");
  });

  it("picks the largest declared image and absolutises the relative URL", () => {
    expect(p.imageUrl).toBe("https://sneaker-store.example/media/products/air-max-90/large.jpg");
  });

  it("accepts brand given as a plain string and @type given as an array", () => {
    expect(p.brand).toBe("Nike");
    expect(p.name).toBe("Nike Air Max 90 - White / Grey");
  });
});

describe("parseProductHtml — bot-wall challenge page", () => {
  it("yields nothing and flags the wall (no 'Just a moment' as a name)", () => {
    const p = parseProductHtml(fixture("bot-wall.html"), "https://www.zara.com/uk/en/jacket-p01234567.html", { status: 403 });
    expect(p.botWall).toBe(true);
    expect(p.name).toBeUndefined();
    expect(p.priceMinor).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
    expect(classify(p)).toBe("failed");
  });

  it("treats a 403 with an empty body as a wall too", () => {
    const p = parseProductHtml("<html><head><title>Error Page | eBay</title></head><body>Error</body></html>", "https://www.ebay.co.uk/itm/1", { status: 403 });
    expect(p.botWall).toBe(true);
    expect(classify(p)).toBe("failed");
  });
});

describe("parseProductHtml — JSON-LD with empty offers + embedded JSON price (ASOS)", () => {
  const p = parseProductHtml(fixture("embedded-json.html"), "https://www.asos.com/saucony/saucony-grid-legacy-trainers-in-silver-and-cream/prd/211224320");

  it("falls through to the embedded state for the current price, not the previous price", () => {
    expect(p.name).toBe("Saucony Grid Legacy trainers in silver and cream");
    expect(p.brand).toBe("Saucony");
    expect(p.priceMinor).toBe(11000);
    expect(p.currency).toBe("GBP");
    expect(p.sources.price).toBe("embedded:asos");
    expect(classify(p)).toBe("ok");
  });
});

describe("parseProductHtml — microdata itemprop price + twitter:image", () => {
  const p = parseProductHtml(fixture("itemprop-price.html"), "https://www.vinted.co.uk/items/123-carhartt");

  it("reads [itemprop=price] content and priceCurrency", () => {
    expect(p.priceMinor).toBe(8950);
    expect(p.currency).toBe("GBP");
    expect(p.sources.price).toBe("itemprop");
  });

  it("strips ' - Vinted' from the title and upgrades a protocol-relative twitter:image", () => {
    expect(p.name).toBe("Carhartt WIP Detroit Jacket Hamilton Brown");
    expect(p.imageUrl).toBe("https://images1.example-cdn.net/t/01_00614/f800/1787239823.webp?s=abc");
    expect(classify(p)).toBe("ok");
  });
});

describe("parseProductHtml — client-rendered app shell", () => {
  it("flags an empty root so Tier 2 can render it, and does not invent fields", () => {
    const p = parseProductHtml(fixture("app-shell.html"), "https://spa-shop.example/p/123");
    expect(p.appShell).toBe(true);
    expect(p.priceMinor).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
  });
});

describe("sanity rules", () => {
  it("rejects svg / logo / favicon images and out-of-range prices", () => {
    const html = `<html><head><title>Thing | Shop</title>
      <meta property="og:image" content="https://shop.example/assets/logo.svg">
      <meta property="product:price:amount" content="0"><meta property="product:price:currency" content="GBP">
      </head><body><p>${"Lorem ipsum dolor sit amet. ".repeat(80)}</p></body></html>`;
    const p = parseProductHtml(html, "https://www.thingshop.example/p/1");
    expect(p.imageUrl).toBeUndefined();
    expect(p.priceMinor).toBeUndefined();
    expect(p.name).toBe("Thing");
    expect(classify(p)).toBe("partial");
  });

  it("rejects prices of £100,000 or more", () => {
    const html = `<html><head><title>Car</title><meta property="product:price:amount" content="125000"></head><body>${"x ".repeat(900)}</body></html>`;
    expect(parseProductHtml(html, "https://cars.example/1").priceMinor).toBeUndefined();
  });
});

describe("image hygiene", () => {
  it("keeps product images whose slug merely contains badge/logo/icon words", () => {
    expect(isLikelyProductImage("https://images.asos-media.com/products/asos-design-cotton-twill-overshirt-with-badge-in-dusty-pink/210983384-1-dustypink")).toBe(true);
    expect(isLikelyProductImage("https://images.asos-media.com/products/polo-ralph-lauren-icon-logo-estate-rib-quarter-zip-jumper-in-beige/211106879-1-beige")).toBe(true);
    expect(isLikelyProductImage("https://cdn.shop.example/products/logo-tee-white.jpg", { declared: true })).toBe(true);
  });

  it("rejects logos, icons, sprites, payment marks and vector formats", () => {
    expect(isLikelyProductImage("https://content.asos-media.com/-/media/images/asos/logo/icon_svg.svg")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/assets/logo.png")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/static/icons/cart.png")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/img/badge-new.png")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/img/klarna-badge.png")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/favicon-32x32.png")).toBe(false);
    expect(isLikelyProductImage("https://shop.example/media/hero.gif")).toBe(false);
  });
});

describe("price parsing", () => {
  it("handles symbols, thousands separators and EU decimal commas", () => {
    expect(parseAmount("£1,299.00")).toBe(1299);
    expect(parseAmount("45,99 €")).toBe(45.99);
    expect(parseAmount("1.299,00")).toBe(1299);
    expect(parseAmount("USD 45.00")).toBe(45);
    expect(parseAmount("1.299")).toBe(1299);
    expect(parseAmount(165)).toBe(165);
    expect(parseAmount("free")).toBeNull();
    expect(parsePriceInput("12.99")).toBe(1299);
    expect(parsePriceInput("£0.10")).toBe(10);
  });
});

describe("cleanName", () => {
  it("strips site suffixes but keeps product descriptors", () => {
    expect(cleanName("Saucony Grid Legacy trainers | ASOS", "www.asos.com")).toBe("Saucony Grid Legacy trainers");
    expect(cleanName("Detroit Jacket - Vinted", "www.vinted.co.uk")).toBe("Detroit Jacket");
    expect(cleanName("Nike Air Max 90 - White", "www.endclothing.com")).toBe("Nike Air Max 90 - White");
    expect(cleanName("Crew Neck T-Shirt | UNIQLO UK", "www.uniqlo.com")).toBe("Crew Neck T-Shirt");
    expect(cleanName("  Tom&#39;s &amp; Jerry&#39;s   Tee ", "shop.example")).toBe("Tom's & Jerry's Tee");
  });
});
