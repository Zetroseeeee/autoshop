import { describe, expect, it } from "vitest";
import { cartLinkFor, shopifyCartUrl } from "../lib/cart";

const base = { qty: 1, platform: null as string | null, variantId: null as string | null };

describe("shopifyCartUrl", () => {
  it("builds a cart permalink that lands on the basket, not checkout", () => {
    const url = shopifyCartUrl("https://finisterre.com/products/into-the-sea", "39665276780621", 1);
    expect(url).toBe("https://finisterre.com/cart/39665276780621:1?storefront=true");
    // Without storefront=true Shopify sends the shopper straight into checkout.
    expect(url).toContain("storefront=true");
  });

  it("carries quantity and clamps it to something sane", () => {
    expect(shopifyCartUrl("https://x.com/products/y", "12345678", 3)).toContain("/cart/12345678:3");
    expect(shopifyCartUrl("https://x.com/products/y", "12345678", 0)).toContain(":1?");
    expect(shopifyCartUrl("https://x.com/products/y", "12345678", 1000)).toContain(":99?");
  });

  it("refuses anything that is not a plausible variant id", () => {
    expect(shopifyCartUrl("https://x.com/products/y", "abc")).toBeNull();
    expect(shopifyCartUrl("https://x.com/products/y", "123")).toBeNull();
    expect(shopifyCartUrl("not a url", "39665276780621")).toBeNull();
  });
});

describe("cartLinkFor", () => {
  it("offers a real add-to-basket link only for Shopify with a variant", () => {
    const link = cartLinkFor({ ...base, url: "https://www.percivalclo.com/products/lungo", store: "percivalclo.com", platform: "shopify", variantId: "56835445981564" });
    expect(link?.kind).toBe("add");
    expect(link?.url).toContain("/cart/56835445981564:1?storefront=true");
  });

  it("falls back to the store's basket page where no add link exists", () => {
    for (const [store, expected] of [
      ["asos.com", "https://www.asos.com/bag"],
      ["uniqlo.com", "https://www.uniqlo.com/uk/en/cart"],
      ["endclothing.com", "https://www.endclothing.com/gb/checkout/cart"],
    ] as const) {
      const link = cartLinkFor({ ...base, url: `https://www.${store}/p/1`, store });
      expect(link?.kind, store).toBe("open");
      expect(link?.url, store).toBe(expected);
    }
  });

  it("says nothing for marketplaces that have no basket", () => {
    expect(cartLinkFor({ ...base, url: "https://www.vinted.co.uk/items/1-x", store: "vinted.co.uk" })).toBeNull();
    expect(cartLinkFor({ ...base, url: "https://www.depop.com/products/x", store: "depop.com" })).toBeNull();
  });

  it("returns nothing for an unknown store rather than guessing a URL", () => {
    expect(cartLinkFor({ ...base, url: "https://some-random-shop.example/p/1", store: "some-random-shop.example" })).toBeNull();
  });

  it("does not offer an add link for Shopify without a variant id", () => {
    const link = cartLinkFor({ ...base, url: "https://shop.example/products/x", store: "shop.example", platform: "shopify" });
    expect(link).toBeNull();
  });
});
