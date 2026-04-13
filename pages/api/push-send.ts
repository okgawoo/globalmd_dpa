import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpush = require('web-push')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

try {
  webpush.setVapidDetails(
    'mailto:admin@dpa.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
} catch (e) {
  console.error('VAPID 설정 오류:', e)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { title, body, url, sent_by } = req.body

    if (!title || !body) {
      return res.status(400).json({ error: '제목과 내용을 입력해주세요' })
    }

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(500).json({ error: 'VAPID 키가 설정되지 않았습니다' })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다' })
    }

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (subError) {
      return res.status(500).json({ error: '구독자 조회 실패: ' + subError.message })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: '구독자가 없습니다' })
    }

    const payload = JSON.stringify({ title, body, url: url || '/', tag: 'dpa-' + Date.now() })

    let successCount = 0
    let failedEndpoints: string[] = []

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        successCount++
      } catch (err: any) {
        console.error('개별 발송 실패:', sub.endpoint, err?.statusCode, err?.body)
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint)
        }
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', failedEndpoints)
    }

    await supabase.from('push_notifications').insert({
      title,
      body,
      url: url || null,
      sent_by: sent_by || null,
      sent_count: successCount,
    })

    return res.status(200).json({
      success: true,
      sent: successCount,
      total: subscriptions.length,
      expired: failedEndpoints.length,
    })
  } catch (err: any) {
    console.error('푸시 발송 오류:', err)
    return res.status(500).json({ error: err.message || '알 수 없는 오류' })
  }
}
