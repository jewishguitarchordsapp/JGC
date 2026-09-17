// Service worker for this app.
//
// Two jobs:
//
// 1. Android Chrome (and some other browsers) treat a registered service
//    worker as part of a site's PWA "installability" — without one, the
//    browser can decline to offer installing this app to the home screen.
//
// 2. Precache the app shell (this page, its manifest, its icons) so the PWA
//    can still open with no network connection at all — needed for the
//    "available offline" feature (see OFFLINE AVAILABILITY in index.html),
//    which stores specific playlists'/favorites' song data in IndexedDB but
//    still needs the page itself to load before any of that is reachable.
//
// This worker deliberately never touches the Apps Script API (cross-origin,
// and POST requests are never intercepted below) or Google's sign-in
// script — this app's own data freshness/offline logic lives in index.html
// (its own API calls + the IndexedDB offline store), not here. This worker
// only ever serves the shell itself, and only as a fallback once the
// network genuinely fails.
const CACHE_NAME = 'jgc-shell-v2';
const SHELL_PATHS = ['./', './index.html', './manifest.json', './icon-192.jpg', './icon-512.jpg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      SHELL_PATHS.map(p => fetch(p).then(res => { if (res.ok) return cache.put(p, res); }).catch(() => {}))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only ever consider same-origin GETs — the Apps Script API (POSTs, and
  // GETs to a different origin) always goes straight to the network,
  // untouched, exactly as before this worker cached anything.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // A page load/reload — network-first (so anyone online always gets the
  // current deploy), falling back to the cached shell only once the
  // network request actually fails (i.e. no connection).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  const isShellAsset = SHELL_PATHS.some(p => req.url === new URL(p, self.registration.scope).href);
  if (!isShellAsset) return; // anything else (e.g. a future asset) passes straight through, uncached

  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req))
  );
});
