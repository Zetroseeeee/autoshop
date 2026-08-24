import type { Item } from "./schema";
import { storeOf } from "./url";

/**
 * Store basket links.
 *
 * Two genuinely different things, kept honest and distinguishable in the UI:
 *
 *  - `add`  — a URL that actually puts THIS item in the store's basket. Only
 *             Shopify offers one as a plain link, via a cart permalink.
 *  - `open` — the store's own basket page. Everywhere else, adding to a basket
 *             requires an authenticated request the store does not expose as a
 *             link, so the best we can do is open the product and the basket.
 *
 * No entry here ever leads to a checkout or a payment step.
 */
export type CartLinkKind = "add" | "open";

export interface CartLink {
  kind: CartLinkKind;
  url: string;
  /** button text */
  label: string;
  /** shown as a title attribute so the difference is never misleading */
  hint: string;
}

/** Basket pages for stores with no add-to-cart URL. Hostname suffix → path. */
const CART_PAGES: Array<[RegExp, string]> = [
  [/(^|\.)asos\.com$/, "https://www.asos.com/bag"],
  [/(^|\.)uniqlo\.com$/, "https://www.uniqlo.com/uk/en/cart"],
  [/(^|\.)endclothing\.com$/, "https://www.endclothing.com/gb/checkout/cart"],
  [/(^|\.)zara\.com$/, "https://www.zara.com/uk/en/shop/cart"],
  [/(^|\.)hm\.com$/, "https://www2.hm.com/en_gb/cart"],
  [/(^|\.)ebay\.co\.uk$/, "https://cart.ebay.co.uk/"],
  [/(^|\.)ebay\.com$/, "https://cart.ebay.com/"],
  [/(^|\.)selfridges\.com$/, "https://www.selfridges.com/GB/en/basket/"],
  [/(^|\.)jdsports\.co\.uk$/, "https://www.jdsports.co.uk/basket/"],
  [/(^|\.)size\.co\.uk$/, "https://www.size.co.uk/basket/"],
  [/(^|\.)mrporter\.com$/, "https://www.mrporter.com/en-gb/shopping-bag"],
  [/(^|\.)ssense\.com$/, "https://www.ssense.com/en-gb/bag"],
  [/(^|\.)farfetch\.com$/, "https://www.farfetch.com/uk/checkout/basket.aspx"],
];

/** Marketplaces where "basket" is not a concept — you buy the single listing. */
const NO_CART = [/(^|\.)vinted\./, /(^|\.)depop\.com$/, /(^|\.)grailed\.com$/];

/**
 * A Shopify cart permalink. `?storefront=true` is essential: without it Shopify
 * sends the shopper straight into checkout, and this app never routes anyone to
 * a payment step.
 */
export function shopifyCartUrl(productUrl: string, variantId: string, qty = 1): string | null {
  if (!/^\d{6,}$/.test(variantId)) return null;
  const quantity = Math.max(1, Math.min(99, Math.floor(qty)));
  try {
    const u = new URL(productUrl);
    return `${u.origin}/cart/${variantId}:${quantity}?storefront=true`;
  } catch {
    return null;
  }
}

export function cartLinkFor(item: Pick<Item, "url" | "store" | "platform" | "variantId" | "qty">): CartLink | null {
  if (item.platform === "shopify" && item.variantId) {
    const url = shopifyCartUrl(item.url, item.variantId, item.qty);
    if (url) {
      return {
        kind: "add",
        url,
        label: "Add to basket",
        hint: "Adds this item to the store's basket, then opens it. You still check out on their site.",
      };
    }
  }
  const host = item.store || storeOf(item.url);
  if (NO_CART.some((re) => re.test(host))) return null;
  const page = CART_PAGES.find(([re]) => re.test(host))?.[1];
  if (!page) return null;
  return {
    kind: "open",
    url: page,
    label: "Open basket",
    hint: `${host} has no add-to-basket link, so this opens their basket page — add the item from its product page first.`,
  };
}

/** True when at least one item in a store group can be added directly. */
export function groupCartLinks(items: Array<Pick<Item, "url" | "store" | "platform" | "variantId" | "qty">>): {
  addLinks: string[];
  openUrl: string | null;
} {
  const addLinks: string[] = [];
  let openUrl: string | null = null;
  for (const it of items) {
    const link = cartLinkFor(it);
    if (!link) continue;
    if (link.kind === "add") addLinks.push(link.url);
    else openUrl ??= link.url;
  }
  return { addLinks, openUrl };
}
