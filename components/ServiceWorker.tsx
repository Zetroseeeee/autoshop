"use client";

import { useEffect } from "react";

/** Registers the minimal service worker so the app installs cleanly as a PWA. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* non-fatal: the app works without a service worker */
    });
  }, []);
  return null;
}
