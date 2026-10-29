/* Namma Info service worker.
 * Kept deliberately minimal: it only exists so Android browsers treat the
 * dashboard as an installable app. It does NOT cache anything, so users
 * always get the latest version and nothing can go stale. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Pass-through for page loads (needed by some older Android Chrome versions
// to allow installing). If the phone is offline, show a tiny notice.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h2>You are offline</h2><p style="opacity:.6">Connect to the internet to open Namma Info.</p></div></body>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    )
  );
});
