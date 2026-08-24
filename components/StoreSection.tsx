"use client";

import { totalMinor } from "@/lib/basket";
import { formatMinor } from "@/lib/money";
import type { Item } from "@/lib/schema";
import { CartButtons } from "./CartButtons";
import { ItemRow, type RowActions } from "./ItemRow";
import { Favicon } from "./Thumb";
import { useStoreLinks } from "./useStoreLinks";

export function StoreSection({
  store,
  items,
  openId,
  busy,
  onToggle,
  actions,
}: {
  store: string;
  items: Item[];
  openId: string | null;
  busy: Record<string, { retry?: boolean; studio?: boolean }>;
  onToggle: (id: string) => void;
  actions: RowActions;
}) {
  const subtotal = totalMinor(items);
  const wantItems = items.filter((i) => i.status === "want");
  const { openAll, copyLinks } = useStoreLinks(wantItems.length ? wantItems : items);

  return (
    <section className="card mb-3 px-4 pb-2 pt-3">
      <header className="flex items-center gap-2">
        <Favicon store={store} />
        <h2 className="min-w-0 truncate text-[13px] font-semibold">{store}</h2>
        <span className="tabular text-[13px] text-grey">· {items.length}</span>
        <span className="tabular ml-auto text-[13px] font-bold">{subtotal > 0 ? formatMinor(subtotal, "GBP") : "—"}</span>
      </header>

      <ul className="divide-y divide-hairline">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} open={openId === item.id} busy={busy[item.id] ?? {}} onToggle={() => onToggle(item.id)} actions={actions} />
        ))}
      </ul>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-1">
        <button type="button" className="btn-text" onClick={openAll}>
          Open all
        </button>
        <button type="button" className="btn-text" onClick={() => void copyLinks()}>
          Copy links
        </button>
        <CartButtons items={items} />
      </footer>
    </section>
  );
}
