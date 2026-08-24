"use client";

import { groupCartLinks } from "@/lib/cart";
import type { Item } from "@/lib/schema";
import { useToast } from "./Toast";
import { ExternalIcon } from "./icons";

/**
 * Basket shortcuts for one store.
 *
 * "Add all to basket" only appears where the store genuinely supports it
 * (Shopify cart permalinks). Everywhere else the honest option is to open the
 * store's own basket page, and the button says so. Neither ever reaches a
 * payment step — the user checks out on the store's site.
 */
export function CartButtons({ items }: { items: Item[] }) {
  const toast = useToast();
  const buyable = items.filter((i) => i.status === "want" && i.stockState !== "out_of_stock");
  const { addLinks, openUrl } = groupCartLinks(buyable.length ? buyable : items);

  if (!addLinks.length && !openUrl) return null;

  function addAll() {
    if (!addLinks.length) return;
    // Each permalink adds one line, so they must be opened in sequence.
    let blocked = 0;
    for (const url of addLinks) {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) blocked++;
    }
    if (blocked) toast("Pop-ups blocked — allow them to add every item at once", "error");
    else toast(addLinks.length === 1 ? "Opening the store's basket" : `Adding ${addLinks.length} items to the store's basket`, "success");
  }

  return (
    <>
      {addLinks.length ? (
        <button type="button" className="btn-text" onClick={addAll} title="Adds these items to the store's basket, then opens it. You still check out on their site.">
          Add all to basket
        </button>
      ) : null}
      {openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-text inline-flex items-center gap-1"
          title="Opens this store's basket page. They provide no add-to-basket link, so add items from their product pages."
        >
          Open basket <ExternalIcon />
        </a>
      ) : null}
    </>
  );
}
