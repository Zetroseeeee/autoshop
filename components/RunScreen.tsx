"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { runStores, totalMinor, type StoreGroup } from "@/lib/basket";
import { formatMinor } from "@/lib/money";
import type { Item } from "@/lib/schema";
import { AppHeader } from "./AppHeader";
import { EmptyState } from "./EmptyState";
import { Favicon, Thumb } from "./Thumb";
import { useToast } from "./Toast";
import { useStoreLinks } from "./useStoreLinks";
import { CheckIcon, Spinner } from "./icons";

export function RunScreen({ initialItems }: { initialItems: Item[] }) {
  // Snapshot the run at mount so marking a store as ordered doesn't reshuffle the sequence.
  const [stores] = useState<StoreGroup[]>(() => runStores(initialItems));
  const [index, setIndex] = useState(0);
  const [ordered, setOrdered] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const current = stores[index];
  const finished = index >= stores.length;

  const orderedStores = useMemo(() => stores.filter((s) => ordered.has(s.store)), [stores, ordered]);
  const orderedCount = orderedStores.reduce((n, s) => n + s.items.length, 0);
  const orderedTotal = orderedStores.reduce((n, s) => n + totalMinor(s.items), 0);

  async function markOrdered() {
    if (!current || busy) return;
    setBusy(true);
    try {
      await Promise.all(current.items.map((it) => api.patch(it.id, { status: "ordered" })));
      setOrdered((s) => new Set(s).add(current.store));
      setIndex((i) => i + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't mark as ordered", "error");
    } finally {
      setBusy(false);
    }
  }

  if (stores.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-5">
        <AppHeader title="Checkout" />
        <EmptyState title="Nothing to check out" body="Everything in your basket is already ordered or has arrived. Add something new from the basket.">
          <Link href="/" className="btn-secondary" prefetch={false}>
            Back to basket
          </Link>
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-5">
      <AppHeader title="Checkout" right={finished ? "Done" : `Store ${index + 1} of ${stores.length}`} />

      <div className="mb-4 flex items-center justify-center gap-2" aria-label="Progress">
        {stores.map((s, i) => {
          const state = ordered.has(s.store) ? "done" : i === index && !finished ? "current" : i < index ? "skipped" : "upcoming";
          return (
            <span
              key={s.store}
              title={s.store}
              className={`block h-2 w-2 rounded-full ${
                state === "done" ? "bg-green" : state === "current" ? "bg-ink" : state === "skipped" ? "bg-grey-light" : "bg-hairline"
              }`}
            />
          );
        })}
      </div>

      {finished ? (
        <section className="card px-6 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green/10 text-green">
            <CheckIcon size={28} />
          </div>
          <h2 className="mt-4 text-[18px] font-bold">Checkout run complete</h2>
          <p className="mt-1 text-[13px] text-grey">
            {orderedCount === 0
              ? "No stores were marked as ordered."
              : `${orderedCount} ${orderedCount === 1 ? "item" : "items"} ordered across ${orderedStores.length} ${orderedStores.length === 1 ? "store" : "stores"}`}
          </p>
          {orderedCount > 0 ? <p className="tabular mt-3 text-[26px] font-bold">{formatMinor(orderedTotal, "GBP")}</p> : null}
          <Link href="/" className="btn-primary mt-6" prefetch={false}>
            Back to basket
          </Link>
        </section>
      ) : current ? (
        <StoreCard key={current.store} group={current} busy={busy} onOrdered={() => void markOrdered()} onSkip={() => setIndex((i) => i + 1)} />
      ) : null}

      <p className="mt-6 text-center text-[12px] text-grey">Approve each payment in your banking app.</p>
    </main>
  );
}

function StoreCard({ group, busy, onOrdered, onSkip }: { group: StoreGroup; busy: boolean; onOrdered: () => void; onSkip: () => void }) {
  const { openAll, copyLinks } = useStoreLinks(group.items);
  const total = totalMinor(group.items);
  const nonGbp = group.items.filter((i) => i.priceMinor != null && (i.currency ?? "GBP") !== "GBP").length;
  const unpriced = group.items.filter((i) => i.priceMinor == null).length;

  return (
    <>
      <section className="card px-4 pb-3 pt-4">
        <header className="flex items-center gap-2">
          <Favicon store={group.store} size={20} />
          <h2 className="min-w-0 truncate text-[15px] font-bold">{group.store}</h2>
          <span className="tabular ml-auto text-[13px] font-bold">{formatMinor(total, "GBP")}</span>
        </header>

        <ul className="mt-2 divide-y divide-hairline">
          {group.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <Thumb item={it} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{it.name || it.url}</p>
                {it.brand ? <p className="truncate text-[11px] text-grey-light">{it.brand}</p> : null}
              </div>
              <div className="text-right">
                <p className="tabular text-[13px] font-bold">{it.priceMinor != null ? formatMinor(it.priceMinor, it.currency) : <span className="text-grey">No price</span>}</p>
                {it.qty > 1 ? <p className="tabular text-[11px] text-grey">× {it.qty}</p> : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="hairline" />
        <div className="flex items-center justify-between py-3">
          <span className="text-[15px] font-bold">Total</span>
          <span className="tabular text-[15px] font-bold">{formatMinor(total, "GBP")}</span>
        </div>
        {nonGbp || unpriced ? (
          <p className="-mt-2 pb-2 text-right text-[11px] text-grey">
            Excludes {[unpriced ? `${unpriced} unpriced` : null, nonGbp ? `${nonGbp} in another currency` : null].filter(Boolean).join(" and ")}
          </p>
        ) : null}
        <div className="hairline" />

        <div className="flex items-center gap-4 pt-1">
          <button type="button" className="btn-text" onClick={openAll}>
            Open all
          </button>
          <button type="button" className="btn-text" onClick={() => void copyLinks()}>
            Copy links
          </button>
        </div>
      </section>

      <button type="button" className="btn-primary mt-4" onClick={onOrdered} disabled={busy}>
        {busy ? <Spinner /> : null}
        Mark as Ordered
      </button>
      <button type="button" className="mt-3 block w-full py-2 text-center text-[13px] font-semibold text-grey" onClick={onSkip} disabled={busy}>
        Skip this store
      </button>
    </>
  );
}
