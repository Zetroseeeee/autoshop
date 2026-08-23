"use client";

import type { ItemStatus } from "@/lib/schema";

const LABEL: Record<ItemStatus, string> = { want: "Want", ordered: "Ordered", arrived: "Arrived" };
const NEXT: Record<ItemStatus, ItemStatus> = { want: "ordered", ordered: "arrived", arrived: "want" };

export function StatusChip({ status, onChange }: { status: ItemStatus; onChange?: (s: ItemStatus) => void }) {
  const cls = `chip chip-${status}`;
  if (!onChange) return <span className={cls}>{LABEL[status]}</span>;
  return (
    <button type="button" className={cls} onClick={() => onChange(NEXT[status])} title={`Mark as ${LABEL[NEXT[status]]}`}>
      {LABEL[status]}
    </button>
  );
}
