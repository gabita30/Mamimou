// Service worker minimal — condition nécessaire pour que Chrome/Android
// déclenche l'événement 'beforeinstallprompt'. Ne fait pas de cache agressif
// pour éviter de servir du contenu périmé sur une app qui change souvent.

const CACHE_NAME = 'cosmos-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Passthrough réseau simple — pas de mise en cache offline pour l'instant.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
