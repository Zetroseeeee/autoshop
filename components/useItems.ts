"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Item } from "@/lib/schema";
import { useToast } from "./Toast";

const POLL_MS = 2500;

/** Client cache of the basket with optimistic edits and polling while fetches are pending. */
export function useItems(initial: Item[], opts: { onFetchFailed?: (id: string) => void } = {}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();
  const prevStates = useRef<Map<string, Item["fetchState"]>>(new Map(initial.map((i) => [i.id, i.fetchState])));
  const onFetchFailed = useRef(opts.onFetchFailed);
  useEffect(() => {
    onFetchFailed.current = opts.onFetchFailed;
  });

  const absorb = useCallback((next: Item[]) => {
    // detect pending → failed transitions so the editor can open on "fill manually"
    for (const it of next) {
      const prev = prevStates.current.get(it.id);
      if (prev === "pending" && it.fetchState === "failed") onFetchFailed.current?.(it.id);
      prevStates.current.set(it.id, it.fetchState);
    }
    setItems(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      absorb(await api.list());
      setLoadError(null);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) setLoadError(err instanceof Error ? err.message : "Could not load basket");
    }
  }, [absorb]);

  const anyPending = items.some((i) => i.fetchState === "pending");
  useEffect(() => {
    if (!anyPending) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [anyPending, refresh]);

  const replace = useCallback((item: Item) => {
    const prev = prevStates.current.get(item.id);
    if (prev === "pending" && item.fetchState === "failed") onFetchFailed.current?.(item.id);
    prevStates.current.set(item.id, item.fetchState);
    setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const add = useCallback(
    async (text: string) => {
      const created = await api.add(text);
      for (const c of created) prevStates.current.set(c.id, c.fetchState);
      setItems((list) => [...created, ...list]);
      return created;
    },
    [],
  );

  const patch = useCallback(
    async (id: string, changes: Partial<Item>) => {
      let before: Item | undefined;
      setItems((list) =>
        list.map((i) => {
          if (i.id !== id) return i;
          before = i;
          return { ...i, ...changes };
        }),
      );
      try {
        replace(await api.patch(id, changes));
      } catch (err) {
        if (before) replace(before);
        toast(err instanceof Error ? err.message : "Could not save", "error");
        throw err;
      }
    },
    [replace, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      const snapshot = items;
      setItems((list) => list.filter((i) => i.id !== id));
      try {
        await api.remove(id);
      } catch (err) {
        setItems(snapshot);
        toast(err instanceof Error ? err.message : "Could not remove", "error");
      }
    },
    [items, toast],
  );

  const retry = useCallback(
    async (id: string) => {
      setItems((list) => list.map((i) => (i.id === id ? { ...i, fetchState: "pending" } : i)));
      try {
        const item = await api.retry(id);
        replace(item);
        if (item.fetchState === "failed") toast("Still couldn't fetch that page — fill it in manually", "error");
        else if (item.fetchState === "partial") toast("Fetched some details — check the rest", "info");
        else toast("Details fetched", "success");
      } catch (err) {
        await refresh();
        toast(err instanceof Error ? err.message : "Retry failed", "error");
      }
    },
    [refresh, replace, toast],
  );

  return { items, setItems, replace, refresh, loadError, add, patch, remove, retry };
}
