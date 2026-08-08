const STATIC_CACHE_PREFIX = "analisa-static-";
const STATIC_CACHE = `${STATIC_CACHE_PREFIX}v1`;
const STATIC_CACHE_MAX_ENTRIES = 96;

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - STATIC_CACHE_MAX_ENTRIES;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(STATIC_CACHE_PREFIX) && name !== STATIC_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js build assets are content-hashed, so cache-first is safe across deploys.
  // Navigations, APIs, auth and user data deliberately remain network/browser-cache
  // controlled to avoid reviving the stale-page behavior from the legacy PWA cache.
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimStaticCache(cache);
      }
      return response;
    }),
  );
});
