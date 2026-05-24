// Service Worker for CapitalForge PWA
const CACHE_NAME = 'capitalforge-v2';

const STATIC_ASSETS = ['/manifest.json'];

function shouldBypassCache(request) {
  if (request.method !== 'GET') {
    return true;
  }

  const url = new URL(request.url);

  // Only handle same-origin static assets; never intercept API or cross-origin calls.
  if (url.origin !== self.location.origin) {
    return true;
  }

  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('__nextjs')
  ) {
    return true;
  }

  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {}),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (shouldBypassCache(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)),
          );
        }
        return response;
      });
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
