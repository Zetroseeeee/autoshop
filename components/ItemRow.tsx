"use client";

import { isGbp } from "@/lib/basket";
import { formatMinor } from "@/lib/money";
import type { Item } from "@/lib/schema";
import { slugWords } from "@/lib/url";
import { ItemEditor } from "./ItemEditor";
import { QtyStepper } from "./QtyStepper";
import { StatusChip } from "./StatusChip";
import { StockChip } from "./StockChip";
import { Thumb } from "./Thumb";

export interface RowActions {
  patch: (id: string, changes: Partial<Item>) => Promise<void>;
  retry: (id: string) => Promise<void>;
  studio: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function ItemRow({
  item,
  open,
  busy,
  onToggle,
  actions,
}: {
  item: Item;
  open: boolean;
  busy: { retry?: boolean; studio?: boolean };
  onToggle: () => void;
  actions: RowActions;
}) {
  const done = item.status !== "want";
  const soldOut = item.stockState === "out_of_stock";
  const pending = item.fetchState === "pending";
  const title = item.name || (pending ? "Fetching details…" : slugWords(item.url) || item.store);

  return (
    <li className="py-3">
      <div className={`flex items-start gap-3 ${done || soldOut ? "opacity-60" : ""}`}>
        <button type="button" onClick={onToggle} className="flex-none" aria-label="Edit item">
          <Thumb item={item} size={64} />
        </button>

        <div className="min-w-0 flex-1">
          <button type="button" onClick={onToggle} className="block w-full text-left">
            <span className={`clamp-2 text-[14px] font-semibold leading-[18px] ${item.name ? "text-ink" : "text-grey"}`}>{title}</span>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Price item={item} onAddPrice={onToggle} />
          </div>
          {item.brand ? <p className="mt-0.5 truncate text-[12px] font-medium text-grey-light">{item.brand}</p> : null}
        </div>

        <div className="flex flex-none flex-col items-end gap-2">
          <StatusChip status={item.status} onChange={(status) => void actions.patch(item.id, { status })} />
          <QtyStepper qty={item.qty} onChange={(qty) => void actions.patch(item.id, { qty })} />
        </div>
      </div>

      {open ? (
        <ItemEditor
          key={`${item.id}:${String(item.updatedAt)}:${item.studioImageUrl ?? ""}`}
          item={item}
          busy={busy}
          onSave={(patch) => actions.patch(item.id, patch)}
          onRetry={() => actions.retry(item.id)}
          onStudio={() => actions.studio(item.id)}
          onRemove={() => actions.remove(item.id)}
          onClose={onToggle}
        />
      ) : null}
    </li>
  );
}

function Price({ item, onAddPrice }: { item: Item; onAddPrice: () => void }) {
  if (item.fetchState === "pending" && item.priceMinor == null) {
    return <span className="text-[13px] font-medium text-grey-light">Fetching…</span>;
  }
  if (item.priceMinor == null) {
    if (item.fetchState === "failed") {
      return (
        <button type="button" onClick={onAddPrice} className="text-left text-[13px] font-semibold text-red">
          Fetch failed — fill manually
        </button>
      );
    }
    return (
      <button type="button" onClick={onAddPrice} className="text-[13px] font-semibold text-accent">
        Add price
      </button>
    );
  }
  const dropped = item.previousPriceMinor != null && item.previousPriceMinor > item.priceMinor;
  return (
    <>
      <span className="tabular text-[14px] font-bold">{formatMinor(item.priceMinor, item.currency)}</span>
      {dropped ? (
        <span className="chip chip-grey">
          was <s className="tabular">{formatMinor(item.previousPriceMinor, item.currency)}</s>
        </span>
      ) : null}
      <StockChip state={item.stockState} checkedAt={item.stockCheckedAt} />
      {!isGbp(item) ? (
        <span className="chip chip-ordered" title="Not included in the GBP total">
          other currency
        </span>
      ) : null}
      {item.qty > 1 ? <span className="tabular text-[12px] font-medium text-grey">× {item.qty}</span> : null}
    </>
  );
}
