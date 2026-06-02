const CACHE_NAME = 'hawaa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/init.js',
  '/js/db.js',
  '/js/expenses.js',
  '/js/utils.js',
  '/js/settings.js',
  '/js/activation.js',
  '/js/notifications.js',
  '/js/sqlite-storage.js',
  '/js/currency-api.js',
  '/js/dashboard.js',
  '/js/export.js',
  '/js/virtual-table.js',
  '/js/crypto-service.js',
  '/lib/sql-wasm.js',
  '/lib/sql-wasm.wasm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  const cache = await caches.open('pending');
  const requests = await cache.keys();
  for (const req of requests) {
    try {
      const response = await fetch(req);
      if (response.ok) await cache.delete(req);
    } catch(e) {}
  }
}
