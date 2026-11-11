// UGL's service worker: the app opens with no signal (Phase 1, step 14). It keeps the app's own
// files: the page (index.html, which serves every address), the built scripts and styles it asks
// for, the icons, and profile photos and team logos once seen, built-in or uploaded (Phase 2).
// Everything else (the database, sign-in, fonts) goes straight to the network; the database keeps its
// own local copy (src/firebase.ts).
//
// The page comes from the network when there's signal, so a new deploy shows up on the next
// visit; the saved copy is only for when there's none. Built files are named by their content, so a
// saved one never goes stale; the ones the newest page no longer asks for are dropped.

const CACHE = 'ugl-app-v1';
// Saved files are found by address alone: the page asks for its scripts with headers (Origin) the
// saved copies weren't fetched with, and the server's Vary would otherwise make them miss
const BY_ADDRESS = { ignoreVary: true, ignoreSearch: false };
const PAGE = '/index.html';
const FILES = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/ugl-logo-v2.png'];

// An uploaded photo or logo, by its download address. Each upload has an address of its own, so a
// saved copy never goes stale.
const isUpload = (url) =>
  ['firebasestorage.googleapis.com', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/v0/b/') && url.searchParams.get('alt') === 'media';

// The built files (/assets/…) an index.html asks for
const assetsIn = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

// Saves a fresh index.html and the built files it asks for, and drops built files it doesn't
async function savePage(response) {
  const cache = await caches.open(CACHE);
  const assets = assetsIn(await response.clone().text());
  await cache.put(PAGE, response);
  await Promise.all(
    assets.map(async (url) => {
      if (await cache.match(url, BY_ADDRESS)) return;
      const file = await fetch(url);
      if (file.ok) await cache.put(url, file);
    }),
  );
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !assets.includes(path)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES);
      const page = await fetch('/', { cache: 'no-cache' });
      if (page.ok) await savePage(page);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'GET' && isUpload(url)) {
    // The saved copy, else the network (and save it). Images from another address come back sealed
    // ("opaque"); they're kept all the same.
    event.respondWith(
      (async () => {
        const saved = await caches.match(request, BY_ADDRESS);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, response.clone())));
        return response;
      })(),
    );
    return;
  }
  // Only this site's own files; Firebase's sign-in helpers (/__/) always go to the network
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;

  if (request.mode === 'navigate') {
    // Every address is the app: the newest page with signal, the saved one without
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && (response.headers.get('content-type') ?? '').includes('text/html')) event.waitUntil(savePage(response.clone()));
          return response;
        } catch {
          return (await caches.match(PAGE, BY_ADDRESS)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Built files never change under the same name: the saved copy, else the network (and save it)
    event.respondWith(
      (async () => {
        const saved = await caches.match(request, BY_ADDRESS);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok) event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, response.clone())));
        return response;
      })(),
    );
    return;
  }

  // Other files (icons, profile photos): the network, saving a copy, or the copy without signal
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, response.clone())));
        return response;
      } catch {
        return (await caches.match(request, BY_ADDRESS)) ?? Response.error();
      }
    })(),
  );
});
