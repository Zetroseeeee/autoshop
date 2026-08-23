"use client";

import { useEffect, useState } from "react";
import { formatMinor, parsePriceInput } from "@/lib/money";
import { ITEM_CATEGORIES, type Item } from "@/lib/schema";
import { Thumb } from "./Thumb";
import { Spinner } from "./icons";

type View = "original" | "studio" | "back";

const CATEGORY_LABEL: Record<(typeof ITEM_CATEGORIES)[number], string> = {
  jacket: "Jacket",
  top: "Top",
  trousers: "Trousers",
  shoes: "Shoes",
  accessory: "Accessory",
  other: "Other",
};

export function ItemEditor({
  item,
  busy,
  onSave,
  onRetry,
  onStudio,
  onRemove,
  onClose,
}: {
  item: Item;
  busy: { retry?: boolean; studio?: boolean };
  onSave: (patch: Partial<Item>) => Promise<void>;
  onRetry: () => Promise<void>;
  onStudio: () => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.priceMinor != null ? (item.priceMinor / 100).toFixed(2) : "");
  const [currency, setCurrency] = useState(item.currency ?? "GBP");
  const [image, setImage] = useState(item.sourceImageUrl ?? "");
  const [category, setCategory] = useState(item.category);
  const [chosenView, setView] = useState<View>(item.studioImageUrl ? "studio" : "original");
  const view: View =
    chosenView === "studio" && !item.studioImageUrl ? "original" : chosenView === "back" && !item.studioBackUrl ? "original" : chosenView;
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field state is seeded from the item; the row remounts the editor (key = updatedAt)
  // whenever a fetch or studio run changes the item underneath us.
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 3000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const dirty =
    name !== item.name ||
    price !== (item.priceMinor != null ? (item.priceMinor / 100).toFixed(2) : "") ||
    currency !== (item.currency ?? "GBP") ||
    image !== (item.sourceImageUrl ?? "") ||
    category !== item.category;

  async function save() {
    setError(null);
    const priceMinor = price.trim() ? parsePriceInput(price) : null;
    if (price.trim() && priceMinor == null) return setError("Enter a price like 45.00");
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) return setError("Currency should be a 3-letter code, e.g. GBP");
    if (image.trim() && !/^https?:\/\//i.test(image.trim())) return setError("Image URL should start with https://");
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        priceMinor,
        currency: priceMinor != null ? currency.trim().toUpperCase() : item.currency,
        sourceImageUrl: image.trim() || null,
        category,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = view === "studio" ? item.studioImageUrl : view === "back" ? item.studioBackUrl : item.sourceImageUrl;
  const hasStudio = Boolean(item.studioImageUrl);

  return (
    <div className="mt-3 rounded-[18px] bg-canvas p-3">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2">
          <Thumb item={item} size={112} src={previewSrc ?? null} />
          {hasStudio ? (
            <div className="flex rounded-full bg-tile p-0.5 text-[11px] font-semibold">
              <ToggleBtn active={view === "original"} onClick={() => setView("original")}>
                Original
              </ToggleBtn>
              <ToggleBtn active={view === "studio"} onClick={() => setView("studio")}>
                Studio
              </ToggleBtn>
              {item.studioBackUrl ? (
                <ToggleBtn active={view === "back"} onClick={() => setView("back")}>
                  Back · AI guess
                </ToggleBtn>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-grey">Name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-grey">Price</span>
              <input
                className="field tabular"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                autoFocus={item.priceMinor == null && item.fetchState !== "pending"}
              />
            </label>
            <label className="block w-[76px]">
              <span className="mb-1 block text-[11px] font-semibold text-grey">Currency</span>
              <input className="field uppercase" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="GBP" />
            </label>
          </div>
        </div>
      </div>

      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-grey">Image URL</span>
        <input
          className="field"
          inputMode="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>

      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-grey">Category (sets the studio shot style)</span>
        <select className="field appearance-none" value={category} onChange={(e) => setCategory(e.target.value as Item["category"])}>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      {item.previousPriceMinor != null && item.priceMinor != null && item.previousPriceMinor > item.priceMinor ? (
        <p className="mt-2 text-[12px] text-grey">
          Price dropped from <s className="tabular">{formatMinor(item.previousPriceMinor, item.currency)}</s>
        </p>
      ) : null}

      {error ? <p className="mt-2 text-[12px] font-medium text-red">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => void onRetry()} disabled={busy.retry || item.fetchState === "pending"}>
          {busy.retry || item.fetchState === "pending" ? <Spinner size={14} /> : null}
          Retry auto-fetch
        </button>
        <button type="button" className="btn-secondary" onClick={() => void onStudio()} disabled={busy.studio || !item.sourceImageUrl} title={item.sourceImageUrl ? undefined : "Add an image URL first"}>
          {busy.studio ? <Spinner size={14} /> : null}
          {hasStudio ? "Regenerate" : "Studio photo"}
        </button>
        <button
          type="button"
          className={`btn-secondary ${confirmRemove ? "!bg-red !text-white" : "!text-red"}`}
          onClick={() => {
            if (confirmRemove) void onRemove();
            else setConfirmRemove(true);
          }}
        >
          {confirmRemove ? "Tap again to remove" : "Remove"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-text !text-grey" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-secondary !bg-ink !text-white" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? <Spinner size={14} /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-2.5 py-1 transition-colors ${active ? "bg-card text-ink shadow-card" : "text-grey"}`}>
      {children}
    </button>
  );
}
