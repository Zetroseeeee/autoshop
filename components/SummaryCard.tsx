"use client";

import Link from "next/link";
import { summarise } from "@/lib/basket";
import { formatMinor } from "@/lib/money";
import type { Item } from "@/lib/schema";

export function SummaryCard({ items }: { items: Item[] }) {
  const s = summarise(items);
  const notes: string[] = [];
  if (s.excludedDone) notes.push(`${s.excludedDone} ordered/arrived`);
  if (s.excludedNonGbp) notes.push(`${s.excludedNonGbp} in another currency`);
  const canCheckout = items.some((i) => i.status === "want");

  return (
    <section className="card mt-4 px-5 pb-5 pt-4">
      <Row label="Items" value={String(s.items)} />
      <Row label="Stores" value={String(s.stores)} />
      <Row label="Unpriced" value={String(s.unpriced)} tone={s.unpriced ? "warn" : undefined} />
      {s.soldOut ? <Row label="Sold out" value={String(s.soldOut)} tone="bad" /> : null}
      <div className="hairline my-3" />
      <div className="flex items-baseline justify-between">
        <span className="text-[18px] font-bold">Total</span>
        <span className="tabular text-[18px] font-bold">{formatMinor(s.totalMinor, "GBP")}</span>
      </div>
      {notes.length ? <p className="mt-1 text-right text-[11px] text-grey">Excludes {notes.join(" and ")}</p> : null}
      <Link href="/run" className={`btn-primary mt-4 ${canCheckout ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!canCheckout} prefetch={false}>
        Checkout · {formatMinor(s.totalMinor, "GBP")}
      </Link>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-grey">{label}</span>
      <span className={`tabular text-[13px] font-semibold ${tone === "warn" ? "text-amber" : tone === "bad" ? "text-red" : ""}`}>{value}</span>
    </div>
  );
}
