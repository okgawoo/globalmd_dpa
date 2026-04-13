import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VAPID_PUBLIC_KEY = 'BEjfYqIMOti5asPsKla0b-bxwiEOGTsAmrqm3pRYrKpQPl4kduPvYTxYrAUs_dHH8fiwXWS-8EUxEP2g4QDiPV8'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(agentId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('푸시 알림 미지원 브라우저')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('알림 권한 거부됨')
      return false
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const subscriptionJson = subscription.toJSON()

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        agent_id: agentId,
        endpoint: subscriptionJson.endpoint,
        p256dh: subscriptionJson.keys?.p256dh || '',
        auth: subscriptionJson.keys?.auth || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id,endpoint' }
    )

    if (error) {
      console.error('구독 저장 실패:', error)
      return false
    }

    console.log('푸시 구독 완료!')
    return true
  } catch (err) {
    console.error('푸시 구독 오류:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    }
    return true
  } catch (err) {
    console.error('구독 해제 오류:', err)
    return false
  }
}
