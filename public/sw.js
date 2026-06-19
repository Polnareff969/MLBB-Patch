const CURRENT_CACHE_VERSION = 'mlbb-engine-v1';
const CORE_RESOURCES = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT_CACHE_VERSION).then((cache) => cache.addAll(CORE_RESOURCES))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
