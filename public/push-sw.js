// DPA 푸시 알림 전용 Service Worker
self.addEventListener('push', function (event) {
  if (!event.data) return

  try {
    var data = event.data.json()
    var options = {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'dpa-notification',
      renotify: true,
      data: {
        url: data.url || '/',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title || 'DPA 알림', options))
  } catch (e) {
    var text = event.data.text()
    event.waitUntil(self.registration.showNotification('DPA 알림', { body: text }))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
