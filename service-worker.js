const CACHE_NAME = 'kerbside-schedule-v1';
const RUNTIME_CACHE = 'kerbside-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
    '/Kerbside-Collection-Schedule/',
    '/Kerbside-Collection-Schedule/index.html',
    '/Kerbside-Collection-Schedule/css/styles.css',
    '/Kerbside-Collection-Schedule/js/script.js',
    '/Kerbside-Collection-Schedule/dataset/kerbside-large-item-collection-schedule.json',
    '/Kerbside-Collection-Schedule/dataset/Kerbside-cleanup-logan.json',
    '/Kerbside-Collection-Schedule/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Precaching assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[Service Worker] Precaching failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.includes('cdnjs.cloudflare.com') &&
        !event.request.url.includes('cdn.jsdelivr.net')) {
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache the fetched response for runtime
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Fetch failed:', error);

                        // Return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/Kerbside-Collection-Schedule/index.html');
                        }
                    });
            })
    );
});

// Background sync for future features
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    if (event.tag === 'sync-collections') {
        event.waitUntil(syncCollections());
    }
});

async function syncCollections() {
    try {
        // Fetch latest data
        const brisbaneResponse = await fetch('/Kerbside-Collection-Schedule/dataset/kerbside-large-item-collection-schedule.json');
        const loganResponse = await fetch('/Kerbside-Collection-Schedule/dataset/Kerbside-cleanup-logan.json');

        if (brisbaneResponse.ok && loganResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/Kerbside-Collection-Schedule/dataset/kerbside-large-item-collection-schedule.json', brisbaneResponse.clone());
            await cache.put('/Kerbside-Collection-Schedule/dataset/Kerbside-cleanup-logan.json', loganResponse.clone());
            console.log('[Service Worker] Collections synced');
        }
    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
    }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(RUNTIME_CACHE).then((cache) => {
                return cache.addAll(event.data.urls);
            })
        );
    }
});
