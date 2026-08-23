"use client";

import { useState } from "react";
import type { Item } from "@/lib/schema";
import { ImageIcon } from "./icons";

/** Prefers the studio packshot, falls back to the source photo; shimmer while pending. */
export function pickThumb(item: Pick<Item, "studioImageUrl" | "sourceImageUrl">): string | null {
  return item.studioImageUrl || item.sourceImageUrl || null;
}

export function Thumb({
  item,
  size,
  src,
  className = "",
}: {
  item: Pick<Item, "studioImageUrl" | "sourceImageUrl" | "fetchState" | "name">;
  size: number;
  /** override the image shown (editor toggle) */
  src?: string | null;
  className?: string;
}) {
  const url = src === undefined ? pickThumb(item) : src;
  const [broken, setBroken] = useState<string | null>(null);
  const pending = item.fetchState === "pending" && !url;
  const style = { width: size, height: size };

  if (pending) return <div className={`tile shimmer ${className}`} style={style} aria-label="Loading image" />;
  if (!url || broken === url)
    return (
      <div className={`tile flex items-center justify-center text-grey-light ${className}`} style={style} aria-label="No image">
        <ImageIcon size={Math.max(18, Math.round(size * 0.34))} />
      </div>
    );
  return (
    <div className={`tile ${className}`} style={style}>
      <img src={url} alt={item.name || "Product"} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(url)} />
    </div>
  );
}

export function Favicon({ store, size = 16 }: { store: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="inline-block rounded-[4px] bg-hairline" style={{ width: size, height: size }} aria-hidden />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(store)}&sz=64`}
      width={size}
      height={size}
      alt=""
      className="rounded-[4px]"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
}
