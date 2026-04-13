const CACHE_NAME = 'neurolink-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard',
  '/project',
  '/css/style.css',
  '/js/app.js',
  '/js/mindmap.js',
  '/js/flashcards.js',
  '/js/slides.js',
  '/js/infographic.js',
  '/js/quiz.js',
  '/js/chat.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  // CRITICAL: Cache API only supports GET requests.
  // HEAD, POST, PUT, DELETE etc. must always go to the network.
  if (event.request.method !== 'GET') {
    return; // Let the browser handle it normally — no caching
  }

  const url = new URL(event.request.url);

  // API calls: Network first, cache as fallback (GET-only)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML & CSS: Network first, then cache (ensures UI updates show immediately)
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/project' ||
    url.pathname === '/dashboard'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (images, fonts, JS): Cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
