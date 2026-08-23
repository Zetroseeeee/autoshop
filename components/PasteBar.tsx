"use client";

import { useRef, useState } from "react";
import { extractUrl } from "@/lib/url";
import { PlusIcon, Spinner } from "./icons";

export function PasteBar({ onAdd }: { onAdd: (text: string) => Promise<unknown> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setValue("");
    } catch {
      /* toast shown by caller */
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form
      className="mb-5 flex items-center gap-2 rounded-full bg-card p-1.5 pl-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(value);
      }}
    >
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        enterKeyHint="go"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Paste a product link"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-grey-light"
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (extractUrl(text)) {
            e.preventDefault();
            setValue(text);
            void submit(text);
          }
        }}
      />
      <button
        type="submit"
        aria-label="Add item"
        disabled={busy || !value.trim()}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
      >
        {busy ? <Spinner /> : <PlusIcon />}
      </button>
    </form>
  );
}
