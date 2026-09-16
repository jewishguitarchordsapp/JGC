// Minimal service worker for this app.
//
// Android Chrome (and some other browsers) treat a registered service
// worker as part of a site's PWA "installability" — without one, the
// browser can decline to offer installing this app to the home screen, or
// the install action can silently fail to create a shortcut.
//
// This app doesn't need offline caching of its own (it already manages
// data freshness via its own API calls), so this worker deliberately does
// no caching — it just passes every request straight through to the
// network, existing purely to satisfy that installability requirement.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
