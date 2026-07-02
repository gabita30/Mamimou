// Service worker — gère l'installation PWA ET les notifications push.
// Ne fait pas de cache agressif pour éviter de servir du contenu périmé
// sur une app qui change souvent.

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

// ────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch (err) {
    payload = { title: 'Cosmos', body: event.data.text() }
  }

  const { title, body, type, notification_id } = payload

  const options = {
    body: body || '',
    icon: '/cosmosnumber.png',
    badge: '/cosmosnumber.png',
    data: { type, notification_id },
    tag: notification_id || undefined,
  }

  event.waitUntil(
    self.registration.showNotification(title || 'Cosmos', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const type = event.notification.data?.type
  const targetPath = type === 'message' ? '/messages' : type === 'signup' ? '/feed' : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        const clientUrl = new URL(client.url)
        if (clientUrl.pathname === targetPath && 'focus' in client) {
          return client.focus()
        }
      }
      if (clientsList.length > 0 && 'focus' in clientsList[0]) {
        clientsList[0].navigate(targetPath)
        return clientsList[0].focus()
      }
      return self.clients.openWindow(targetPath)
    })
  )
})
