// public/sw.js

const CACHE_NAME = 'kiviatgo-v2'; // IMPORTANT : Change la version du cache
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png'
  // Vite mettra les assets JS/CSS en cache dynamiquement
];

// 1. Installation : mise en cache de l'"app shell"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// 2. Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Suppression de l\'ancien cache', cacheName);
            return caches.delete(cacheName); // Supprime les caches qui ne sont pas v2
          }
        })
      );
    }).then(() => self.clients.claim()) // Prend le contrôle immédiatement
  );
});

// 3. Fetch : Stratégie "Network-first" pour le HTML, "Cache-first" pour le reste
self.addEventListener('fetch', (event) => {
  
  // Stratégie "Network-first" pour les pages HTML (navigation)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si le réseau fonctionne, on met en cache la nouvelle version
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Si le réseau échoue, on prend la version en cache
          return caches.match(event.request)
            .then(response => response || caches.match('/')); // Fallback
        })
    );
    return;
  }

  // Stratégie "Cache-first" pour les autres assets (CSS, JS, Images)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 1. Tenter de servir depuis le cache
        if (response) {
          return response;
        }
        
        // 2. Sinon, aller sur le réseau
        return fetch(event.request).then(response => {
          // Si la réponse est valide, on la met en cache pour la prochaine fois
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Page hors-ligne (uniquement si tout échoue)
        return new Response(
          `<html>... (hors-ligne) ...</html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
  );
});