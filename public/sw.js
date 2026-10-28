// FOfit Service Worker — gestisce le push notification

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Ricevi push notification
self.addEventListener('push', e => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { title: 'FOfit', body: e.data ? e.data.text() : '' }
  }

  const title = data.title || 'FOfit'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/notifiche' },
    requireInteraction: false,
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

// Click sulla notifica → apri app alla sezione notifiche
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/notifiche'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
