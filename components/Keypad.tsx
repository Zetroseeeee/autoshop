"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const MAX_LEN = 12;

export function Keypad({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      if (!value || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/unlock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: value }),
        });
        if (res.ok) {
          router.replace(next);
          router.refresh();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Wrong code");
        setShake(true);
        setCode("");
      } catch {
        setError("Network error — try again");
      } finally {
        setBusy(false);
      }
    },
    [busy, next, router],
  );

  const press = useCallback(
    (digit: string) => {
      setError(null);
      setCode((c) => (c.length >= MAX_LEN ? c : c + digit));
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Enter") void submit(code);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [code, press, submit]);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 350);
    return () => clearTimeout(t);
  }, [shake]);

  const dots = Math.max(4, Math.min(MAX_LEN, code.length + (code.length >= 4 ? 1 : 0)));

  return (
    <div className="card px-6 pb-6 pt-8">
      <div className="text-center">
        <h1 className="text-[26px] font-bold leading-8">Basket</h1>
        <p className="mt-1 text-[13px] text-grey">{configured ? "Enter passcode" : "ACCESS_CODE is not set on the server"}</p>
      </div>

      <div
        className={`mx-auto mt-7 flex h-4 items-center justify-center gap-3 ${shake ? "shake" : ""}`}
        aria-live="polite"
        aria-label={`${code.length} digits entered`}
      >
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`block h-3 w-3 rounded-full transition-colors ${i < code.length ? "bg-ink" : "bg-hairline"}`}
          />
        ))}
      </div>

      <p className={`mt-3 h-5 text-center text-[13px] font-medium text-red ${error ? "" : "invisible"}`}>
        {error ?? " "}
      </p>

      <div className="mx-auto mt-4 grid grid-cols-[repeat(3,72px)] justify-center gap-x-7 gap-y-3">
        {KEYS.map((k) => (
          <Key key={k} label={k} onClick={() => press(k)} disabled={busy || !configured} />
        ))}
        <button
          type="button"
          aria-label="Delete"
          onClick={() => setCode((c) => c.slice(0, -1))}
          disabled={busy || code.length === 0}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-ink active:bg-tile disabled:text-grey-light"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <path d="m18 9-6 6M12 9l6 6" />
          </svg>
        </button>
        <Key label="0" onClick={() => press("0")} disabled={busy || !configured} />
        <button
          type="button"
          aria-label="Unlock"
          onClick={() => void submit(code)}
          disabled={busy || code.length === 0}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Key({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[72px] w-[72px] rounded-full bg-tile text-[26px] font-medium text-ink transition-colors active:bg-hairline disabled:opacity-40"
    >
      {label}
    </button>
  );
}
