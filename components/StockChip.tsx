"use client";

import type { StockState } from "@/lib/schema";

/**
 * Only states that change a decision are shown. "In stock" and "unknown" render
 * nothing — a chip on every row would be noise, and "unknown" must never be
 * dressed up as reassurance when the page simply did not say.
 */
export function StockChip({ state, checkedAt }: { state: StockState; checkedAt?: Date | string | null }) {
  if (state === "in_stock" || state === "unknown") return null;
  const when = checkedAt ? new Date(checkedAt) : null;
  const ago = when ? relative(when) : null;
  if (state === "out_of_stock") {
    return (
      <span className="chip chip-red" title={ago ? `Not available when last checked ${ago}` : "Not available when last checked"}>
        Sold out
      </span>
    );
  }
  return (
    <span className="chip chip-ordered" title={ago ? `Low stock when last checked ${ago}` : "Low stock"}>
      Low stock
    </span>
  );
}

function relative(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
