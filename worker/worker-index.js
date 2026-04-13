// DPA 커스텀 Service Worker - 푸시 알림 수신
// next-pwa가 이 파일을 기본 SW에 병합합니다

self.addEventListener('push', function (event) {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
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
    const text = event.data.text()
    event.waitUntil(self.registration.showNotification('DPA 알림', { body: text }))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
    for (var i = 0; i < clientList.length; i++) {
      var client = clientList[i]
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        client.navigate(url)
        return client.focus()
      }
    }
    return clients.openWindow(url)
  }))
})
