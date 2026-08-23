"use client";

import { useRef, useState } from "react";
import { useToast } from "./Toast";
import { Spinner } from "./icons";

export function ImportExport() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function importFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON");
      }
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) });
      const data = (await res.json().catch(() => ({}))) as { imported?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast(`Imported ${data.imported ?? 0} ${data.imported === 1 ? "item" : "items"}${data.skipped ? ` · skipped ${data.skipped} already present` : ""}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="card mt-3 px-5 py-4">
      <h2 className="text-[13px] font-semibold text-grey">Backup</h2>
      <p className="mt-1 text-[13px] text-grey">Export every item as JSON, or import a previous export (duplicate links are skipped).</p>
      <div className="mt-3 flex gap-2">
        <a href="/api/export" download className="btn-secondary">
          Export JSON
        </a>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Spinner size={14} /> : null}
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
        />
      </div>
    </section>
  );
}
