/** Client-side fetch helpers for the JSON API. */
import type { Item } from "./schema";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 401) {
    // session expired: hard-navigate to the passcode screen (absolute URL, full reload on purpose)
    window.location.replace(new URL(`/unlock?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin).href);
    throw new ApiError("Locked", 401);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  list: () => request<{ items: Item[] }>("/api/items").then((r) => r.items),
  add: (text: string) => request<{ items: Item[] }>("/api/items", { method: "POST", body: JSON.stringify({ text }) }).then((r) => r.items),
  patch: (id: string, patch: Record<string, unknown>) =>
    request<{ item: Item }>(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((r) => r.item),
  remove: (id: string) => request<{ ok: true }>(`/api/items/${id}`, { method: "DELETE" }),
  retry: (id: string) => request<{ item: Item }>(`/api/items/${id}/enrich`, { method: "POST" }).then((r) => r.item),
  studio: (id: string) => request<{ item: Item; message?: string }>(`/api/items/${id}/studio`, { method: "POST" }),
};
