/* Basket service worker — minimal, so the app installs cleanly. No offline support (by design). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // let the browser handle assets/API directly
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Basket</title><body style='font-family:-apple-system,system-ui,sans-serif;background:#f5f5f7;color:#111114;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><p>Basket needs a connection.</p>",
          { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
