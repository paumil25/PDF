// Paumil PDF Studio — Service Worker
// Strategy: Cache-First for the app shell, with network fallback.
// All PDF processing is client-side, so we cache the full HTML file.

const CACHE_NAME = 'paumil-pdf-studio-v1';

// The main HTML file is the entire app (it's self-contained).
const APP_SHELL = [
  './1.Paumil PDF Tool Improved - Copy.html',
  './manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  // Take control immediately without waiting for old SW to die
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Claim all clients so the SW is active right away
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Strategy: Cache-First → Network → (offline fallback already in cache)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension / devtools requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http') && !event.request.url.startsWith('./')) return;

  // For Google Fonts and other CDN assets: Network-first with cache fallback
  const url = new URL(event.request.url);
  const isCDN =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.') ;

  if (isCDN) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache good responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For the app shell: Cache-First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      // Not in cache — try network, then cache the response
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
