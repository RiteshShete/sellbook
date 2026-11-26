// Push-only service worker: shows the alert sent by the push-owner function and opens the order on tap.
// It caches nothing and never touches the network, so it cannot make the app stale.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === 'string' ? data.title : 'Sellbook'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: 'icons/icon-192.png',
      data: { url: typeof data.url === 'string' ? data.url : self.registration.scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || self.registration.scope
  // Only ever open a page of this app.
  const target = url.startsWith(self.registration.scope) ? url : self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      const open = all.find((c) => c.url.startsWith(self.registration.scope))
      if (open) return open.focus().then(() => ('navigate' in open ? open.navigate(target) : undefined))
      return self.clients.openWindow(target)
    }),
  )
})
