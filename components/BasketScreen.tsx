"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { groupByStore } from "@/lib/basket";
import type { Item } from "@/lib/schema";
import { AppHeader } from "./AppHeader";
import { EmptyState } from "./EmptyState";
import type { RowActions } from "./ItemRow";
import { PasteBar } from "./PasteBar";
import { StoreSection } from "./StoreSection";
import { SummaryCard } from "./SummaryCard";
import { useToast } from "./Toast";
import { useItems } from "./useItems";
import { SparkIcon, Spinner } from "./icons";

type Busy = Record<string, { retry?: boolean; studio?: boolean }>;

export function BasketScreen({ initialItems, studioEnabled }: { initialItems: Item[]; studioEnabled: boolean }) {
  const { items, replace, refresh, loadError, add, patch, remove, retry, justFailed, clearJustFailed } = useItems(initialItems);
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>({});
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  // "Fetch failed — fill manually": open the editor when a fetch lands in the failed state
  useEffect(() => {
    if (!justFailed) return;
    setOpenId(justFailed);
    clearJustFailed();
  }, [justFailed, clearJustFailed]);

  const setFlag = useCallback((id: string, key: "retry" | "studio", on: boolean) => {
    setBusy((b) => ({ ...b, [id]: { ...b[id], [key]: on } }));
  }, []);

  const studio = useCallback(
    async (id: string) => {
      setFlag(id, "studio", true);
      try {
        const { item, message } = await api.studio(id);
        replace(item);
        toast(message ?? "Studio photo ready", message ? "info" : "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Studio photo failed — showing the original", "error");
      } finally {
        setFlag(id, "studio", false);
      }
    },
    [replace, setFlag, toast],
  );

  const actions: RowActions = useMemo(
    () => ({
      patch,
      remove: async (id) => {
        setOpenId((o) => (o === id ? null : o));
        await remove(id);
      },
      retry: async (id) => {
        setFlag(id, "retry", true);
        try {
          await retry(id);
        } finally {
          setFlag(id, "retry", false);
        }
      },
      studio,
    }),
    [patch, remove, retry, setFlag, studio],
  );

  const onAdd = useCallback(
    async (text: string) => {
      try {
        const created = await add(text);
        toast(created.length > 1 ? `Added ${created.length} items` : "Added — fetching details", "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not add that link", "error");
        throw err;
      }
    },
    [add, toast],
  );

  const missingStudio = items.filter((i) => i.sourceImageUrl && !i.studioImageUrl && i.fetchState !== "pending");

  async function generateAllMissing() {
    if (!missingStudio.length || bulk) return;
    setBulk({ done: 0, total: missingStudio.length });
    let failures = 0;
    for (const [idx, item] of missingStudio.entries()) {
      try {
        const { item: updated, message } = await api.studio(item.id);
        replace(updated);
        if (message) {
          toast(message, "info");
          break; // cap reached or studio disabled — no point continuing
        }
      } catch (err) {
        failures++;
        toast(err instanceof Error ? err.message : "Studio photo failed", "error");
        if (err instanceof Error && /cap|limit|not configured/i.test(err.message)) break;
      }
      setBulk({ done: idx + 1, total: missingStudio.length });
    }
    setBulk(null);
    if (!failures) toast("Studio photos done", "success");
    await refresh();
  }

  const groups = groupByStore(items);
  const storeCount = groups.length;

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-12 pt-5">
      <AppHeader
        title="Basket"
        right={
          items.length ? (
            <>
              {items.length} {items.length === 1 ? "item" : "items"} · {storeCount} {storeCount === 1 ? "store" : "stores"}
            </>
          ) : null
        }
      />

      <PasteBar onAdd={onAdd} />

      {loadError ? (
        <div className="card mb-3 flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
          <span className="text-red">Couldn&apos;t refresh the basket — {loadError}</span>
          <button type="button" className="btn-secondary" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="Your basket is empty" body="Paste a product link above, share one from Safari with the Add to Basket shortcut, or use the share sheet on Android." />
      ) : (
        <>
          {groups.map((g) => (
            <StoreSection key={g.store} store={g.store} items={g.items} openId={openId} busy={busy} onToggle={(id) => setOpenId((o) => (o === id ? null : id))} actions={actions} />
          ))}

          {studioEnabled && missingStudio.length ? (
            <button type="button" className="btn-secondary mt-1 w-full" onClick={() => void generateAllMissing()} disabled={Boolean(bulk)}>
              {bulk ? <Spinner size={14} /> : <SparkIcon />}
              {bulk ? `Generating ${bulk.done}/${bulk.total}…` : `Generate all missing studio photos (${missingStudio.length})`}
            </button>
          ) : null}

          <SummaryCard items={items} />
        </>
      )}
    </main>
  );
}
