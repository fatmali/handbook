/* global __URLS__ */
const CACHE = 'handbook-__VERSION__';
const URLS = __URLS__;
const allowed = new Set(URLS.map(url => new URL(url, self.location.origin).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('handbook-') && name !== CACHE).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/handbook/')) return;
  if (request.mode === 'navigate') {
    // Keep HTML and hashed assets in the controlling release until explicit update activation.
    event.respondWith(caches.open(CACHE).then(cache => cache.match('/handbook/index.html')).then(response => response || fetch(request)));
  } else if (allowed.has(url.href)) {
    // Only identical public release assets are cached; Vite's Vary: Origin must not hide them offline.
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request, { ignoreVary: true })).then(response => response || fetch(request)));
  }
});
