// sw.js - GitHub Pages Compatible

const CACHE_NAME = 'cleandash-v1';

// ⚠️ Note: Removed the leading "/" from filenames
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'style.css',
  'manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});