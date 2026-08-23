"use client";

import { MinusIcon, PlusIcon } from "./icons";

export function QtyStepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  return (
    <div className="inline-flex h-8 items-center rounded-full bg-tile">
      <button
        type="button"
        aria-label="Decrease quantity"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink disabled:text-grey-light"
        disabled={qty <= 1}
        onClick={() => onChange(Math.max(1, qty - 1))}
      >
        <MinusIcon />
      </button>
      <span className="tabular min-w-[14px] text-center text-[13px] font-semibold">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink disabled:text-grey-light"
        disabled={qty >= 99}
        onClick={() => onChange(Math.min(99, qty + 1))}
      >
        <PlusIcon size={14} />
      </button>
    </div>
  );
}
