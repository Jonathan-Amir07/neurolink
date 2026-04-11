const CACHE_NAME = 'neurolink-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/project.html',
  '/css/style.css',
  '/js/app.js',
  '/js/mindmap.js',
  '/js/flashcards.js',
  '/js/slides.js',
  '/js/infographic.js',
  '/js/quiz.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Permanent+Marker&family=Patrick+Hand&family=Indie+Flower&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
