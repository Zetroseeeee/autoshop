import { HOME_CURRENCY } from "./money";
import type { Item } from "./schema";

export interface StoreGroup {
  store: string;
  items: Item[];
}

/** Group items by store, stores ordered by first appearance (newest item first). */
export function groupByStore(list: Item[]): StoreGroup[] {
  const map = new Map<string, Item[]>();
  for (const it of list) {
    const arr = map.get(it.store);
    if (arr) arr.push(it);
    else map.set(it.store, [it]);
  }
  return [...map.entries()].map(([store, its]) => ({ store, items: its }));
}

/** Money rule used everywhere: totals count `want` items priced in GBP, qty-weighted. */
export const isGbp = (it: Pick<Item, "currency">) => (it.currency ?? HOME_CURRENCY).toUpperCase() === HOME_CURRENCY;
export const isPriced = (it: Pick<Item, "priceMinor">) => it.priceMinor != null;
export const countsTowardsTotal = (it: Item) => it.status === "want" && isPriced(it) && isGbp(it);

export function totalMinor(list: Item[]): number {
  return list.filter(countsTowardsTotal).reduce((s, it) => s + (it.priceMinor ?? 0) * it.qty, 0);
}

export interface BasketSummary {
  items: number;
  stores: number;
  unpriced: number;
  totalMinor: number;
  /** items not counted because they are ordered/arrived */
  excludedDone: number;
  /** items not counted because they are priced in another currency */
  excludedNonGbp: number;
  /** items last seen as unavailable — still counted, but worth flagging */
  soldOut: number;
}

export function summarise(list: Item[]): BasketSummary {
  return {
    items: list.length,
    stores: new Set(list.map((i) => i.store)).size,
    unpriced: list.filter((i) => !isPriced(i)).length,
    totalMinor: totalMinor(list),
    excludedDone: list.filter((i) => i.status !== "want" && isPriced(i) && isGbp(i)).length,
    excludedNonGbp: list.filter((i) => i.status === "want" && isPriced(i) && !isGbp(i)).length,
    soldOut: list.filter((i) => i.status === "want" && i.stockState === "out_of_stock").length,
  };
}

/** Stores that still have something to buy, with only their `want` items. */
export function runStores(list: Item[]): StoreGroup[] {
  return groupByStore(list.filter((i) => i.status === "want"));
}

