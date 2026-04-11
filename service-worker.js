const CACHE_NAME = 'neurolink-cache-v3';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy for API calls: Network first, then cache (GET only)
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request).catch(err => {
          console.error('[SW] API POST failed:', err);
          return new Response(JSON.stringify({ error: 'Offline or connection failed' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Strategy for Static Assets: Cache first, then network
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((response) => {
      return response || fetch(event.request).catch(() => {
        return caches.match('/'); 
      });
    })
  );
});
