const VERSION = "v65";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request, { cache: "reload" }).catch(() => caches.match(event.request)),
  );
});
