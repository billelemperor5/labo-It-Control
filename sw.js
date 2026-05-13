const CACHE_NAME = 'labo-it-v1.0.1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './search.css',
    './assets/app-icon.png',
    './assets/logo.png',
    './manifest.json'
];

// Install Event - Caching Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting(); // Force the new Service Worker to become active immediately
});

// Activate Event - Cleaning Up Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache...', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event - Serve from Cache, Fallback to Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
