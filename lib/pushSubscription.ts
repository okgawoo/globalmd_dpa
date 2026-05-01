import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKRYcg5gpzAEm63IaHTJk5Ay5nsaX0STCfd6Nunr-rxQlrqIB-rGq_As2gzAn12ZA1iEWNts2cae5v_ZQPu_KAI'

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

    // push-sw.js 별도 등록
    const pushReg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    let subscription = await pushReg.pushManager.getSubscription()

    // 기존 구독이 있으면 VAPID 키 일치 여부 확인 → 불일치 시 강제 재구독
    if (subscription) {
      const currentKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      const subscriptionKey = (subscription.options as any)?.applicationServerKey
      if (subscriptionKey) {
        const subKeyBytes = new Uint8Array(subscriptionKey as ArrayBuffer)
        const keyMatches = currentKeyBytes.length === subKeyBytes.length &&
          currentKeyBytes.every((b, i) => b === subKeyBytes[i])
        if (!keyMatches) {
          await subscription.unsubscribe()
          subscription = null
        }
      }
    }

    if (!subscription) {
      subscription = await pushReg.pushManager.subscribe({
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
