const CACHE = "eforge-shell-v5-forjado";
const BRAND = "/brand/forjado/";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/manifest.webmanifest?v=forjado-20261006",
  ...[
    "eforge-logo-header.svg",
    "eforge-logo-horizontal-preto.svg",
    "eforge-simbolo-roxo.svg",
    "eforge-icone-app.svg",
    "eforge-icone-maskable.svg",
    "eforge-favicon.svg",
    "icon-app-192.png",
    "icon-app-512.png",
    "icon-maskable-192.png",
    "icon-maskable-512.png",
    "apple-touch-icon.png",
    "favicon-32.png",
  ].map((file) => BRAND + file),
];

self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("eforge-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Static files only; API/auth responses and local workout data stay outside this cache.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith(BRAND) ||
    url.pathname === "/manifest.webmanifest"
  )
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
  // Dashboard SSR is a loading shell; keep the existing navigation fallback.
  else if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (url.pathname === "/dashboard" && response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put("/app-shell", response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match("/app-shell")) || caches.match("/offline.html")),
    );
});
