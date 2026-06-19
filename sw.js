const CACHE_NAME = 'labo-it-cache-v2.9.9';
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
// Fetch Event - Network-first for app shell files, cache fallback offline.
self.addEventListener('fetch', (e) => {
    // Avoid caching Firebase Auth and Firestore network requests!
    if (e.request.url.includes('firebase') || e.request.url.includes('firestore') || e.request.url.includes('googleapis')) {
        return;
    }

    const requestUrl = new URL(e.request.url);
    const isAppShell =
        requestUrl.pathname.endsWith('/') ||
        requestUrl.pathname.endsWith('/index.html') ||
        requestUrl.pathname.endsWith('/css/style.css') ||
        requestUrl.pathname.endsWith('/js/app.js') ||
        requestUrl.pathname.endsWith('/manifest.json');

    if (isAppShell) {
        e.respondWith(
            fetch(e.request)
                .then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            return cachedResponse || fetch(e.request);
        })
    );
});
