// RocketDB Service Worker — offline cache + notification relay
const CACHE = 'rocketdb-v1'
const SHELL = [
  '/RocketDB/',
  '/RocketDB/index.html',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for API calls, cache-first for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Pass through non-GET and cross-origin API requests
  if (e.request.method !== 'GET') return
  if (url.hostname !== self.location.hostname) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// Notification click — focus or open app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/RocketDB/') && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/RocketDB/')
    })
  )
})
