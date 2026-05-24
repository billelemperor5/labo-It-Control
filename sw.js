const CACHE_NAME = 'labo-it-cache-v3.3';
const ASSETS_TO_CACHE = [
    'index.html',
    'css/style.css',
    'js/app.js',
    'manifest.json',
    'assets/icon_192.png',
    'assets/icon_512.png',
    'assets/logo-pdf.png',
    'assets/dev-avatar.png'
];

// Install Event
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Stale-While-Revalidate / Cache fallback strategy
self.addEventListener('fetch', (e) => {
    // Avoid caching Firebase Auth and Firestore network requests!
    if (e.request.url.includes('firebase') || e.request.url.includes('firestore') || e.request.url.includes('googleapis')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch in background to update cache (Stale-While-Revalidate)
                fetch(e.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
                    }
                }).catch(() => { /* Ignore offline fetch errors */ });
                return cachedResponse;
            }
            return fetch(e.request);
        })
    );
});
