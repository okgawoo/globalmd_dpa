import { useEffect, useState } from 'react'
import { subscribeToPush } from './pushSubscription'

export function usePushNotification(agentId: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setIsSupported(supported)

    if (!supported || !agentId) return

    // 이미 권한 허용된 경우 자동 구독
    if (Notification.permission === 'granted') {
      subscribeToPush(agentId).then(setIsSubscribed)
    }
  }, [agentId])

  async function requestSubscription() {
    if (!agentId || !isSupported) return false
    const result = await subscribeToPush(agentId)
    setIsSubscribed(result)
    return result
  }

  return { isSubscribed, isSupported, requestSubscription }
}
