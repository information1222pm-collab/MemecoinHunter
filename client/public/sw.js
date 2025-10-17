// Service Worker for MemeCoin Hunter
// Version 1.0.0

const CACHE_NAME = 'memecoin-hunter-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';
const API_CACHE = 'api-cache-v1';

// Core assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
  '/api/auth/me',
  '/api/portfolio',
  '/api/tokens',
  '/api/settings',
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to cache static assets, but don't fail on errors
      return Promise.allSettled(
        STATIC_ASSETS.map(url => 
          cache.add(url).catch(err => console.log(`Failed to cache ${url}:`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and WebSocket connections
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip HMR and Vite-specific requests
  if (url.pathname.includes('/@vite') || url.pathname.includes('/__vite') || 
      url.pathname.includes('/node_modules') || url.pathname.includes('/@react-refresh')) {
    return;
  }
  
  // API requests - Network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(cache => {
        return fetch(request)
          .then(response => {
            // Clone the response before caching
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Network failed, try cache
            return cache.match(request).then(cached => {
              if (cached) {
                console.log('Serving API from cache:', url.pathname);
                return cached;
              }
              // Return offline fallback for API
              return new Response(
                JSON.stringify({ error: 'Offline', cached: false }), 
                { headers: { 'Content-Type': 'application/json' } }
              );
            });
          });
      })
    );
    return;
  }
  
  // Static assets - Cache first, fall back to network
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Update cache in background
          fetch(request).then(response => {
            if (response.status === 200) {
              caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cached;
        }
        
        // Not in cache, fetch and cache
        return fetch(request).then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // HTML pages - Network first for freshness
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      Promise.all(names.map(name => caches.delete(name)))
        .then(() => {
          event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
        });
    });
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trades') {
    event.waitUntil(
      // Sync pending trades when back online
      fetch('/api/trades/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending: true })
      })
    );
  }
});