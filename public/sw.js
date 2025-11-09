const CACHE_NAME = 'kiviatgo-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return new Response(
              `<html>
                <body style="font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #10b981;">
                  <h1>🦋 Pas de réseau ?</h1>
                  <p>Fais 10 pompes le temps que ça revienne 💪</p>
                </body>
              </html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        });
      })
  );
});