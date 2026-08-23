"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Kind = "info" | "success" | "error";
interface Toast {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const recent = useRef<{ message: string; at: number } | null>(null);

  const push = useCallback((message: string, kind: Kind = "info") => {
    // Collapse duplicates fired within a second (double taps, StrictMode double effects).
    const now = Date.now();
    if (recent.current && recent.current.message === message && now - recent.current.at < 1000) return;
    recent.current = { message, at: now };
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 5000 : 3000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-[420px] rounded-full px-4 py-2.5 text-[13px] font-semibold text-white shadow-card ${
              t.kind === "error" ? "bg-red" : t.kind === "success" ? "bg-green" : "bg-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
