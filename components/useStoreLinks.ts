"use client";

import type { Item } from "@/lib/schema";
import { useToast } from "./Toast";

/** "Open all" / "Copy links" for a store's items. Opening many tabs needs popups allowed. */
export function useStoreLinks(items: Pick<Item, "url">[]) {
  const toast = useToast();
  const urls = [...new Set(items.map((i) => i.url))];

  function openAll() {
    if (!urls.length) return;
    let blocked = 0;
    for (const url of urls) {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) blocked++;
    }
    if (blocked === urls.length) toast("Pop-ups blocked — allow pop-ups for this site, or use Copy links", "error");
    else if (blocked > 0) toast(`${blocked} of ${urls.length} links were blocked — allow pop-ups to open them all`, "error");
  }

  async function copyLinks() {
    if (!urls.length) return;
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      toast(`Copied ${urls.length} ${urls.length === 1 ? "link" : "links"}`, "success");
    } catch {
      toast("Couldn't access the clipboard", "error");
    }
  }

  return { openAll, copyLinks, urls };
}
