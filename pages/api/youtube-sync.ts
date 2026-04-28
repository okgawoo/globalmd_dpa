import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Cron Job용 — 신규 영상 감지 + 자동 분석 트리거
// GitHub Actions에서 매주 호출

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YT_API_KEY = process.env.YOUTUBE_API_KEY
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://globalmd-dpa.vercel.app'
const CRON_SECRET = process.env.CRON_SECRET

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Cron 보안 토큰 검증
  const secret = req.headers['x-cron-secret']
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ error: '인증 실패' })
  }

  // 활성 채널 전체 조회
  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('is_active', true)

  if (!channels || channels.length === 0) {
    return res.status(200).json({ message: '활성 채널 없음' })
  }

  const results: any[] = []

  for (const channel of channels) {
    // 채널 ID 추출
    let channelId = ''
    const channelMatch = channel.channel_url?.match(/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (channelMatch) {
      channelId = channelMatch[1]
    } else if (YT_API_KEY && channel.handle) {
      try {
        const handle = channel.handle.replace('@', '')
        const r = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YT_API_KEY}`
        )
        const d = await r.json()
        channelId = d.items?.[0]?.id || ''
      } catch {}
    }

    if (!channelId) {
      results.push({ channel: channel.name, error: '채널 ID 없음', newVideos: 0 })
      continue
    }

    // RSS로 최신 영상 확인 (API 키 없어도 동작)
    let newVideoCount = 0
    try {
      const rssRes = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      )
      const rssText = await rssRes.text()

      // XML 파싱 (정규식 사용)
      const extractAll = (text: string, pattern: RegExp): string[] => {
        const results: string[] = []
        let match
        const re = new RegExp(pattern.source, 'g')
        while ((match = re.exec(text)) !== null) results.push(match[1])
        return results
      }

      const videoIds = extractAll(rssText, /<yt:videoId>([^<]+)<\/yt:videoId>/)
      const titles = extractAll(rssText, /<title>([^<]+)<\/title>/).slice(1)
      const dates = extractAll(rssText, /<published>([^<]+)<\/published>/)
        .map(d => d.split('T')[0])

      // 기존 video_id 목록
      const { data: existing } = await supabase
        .from('youtube_videos')
        .select('video_id')
        .eq('channel_id', channel.id)

      const existingIds = new Set((existing || []).map((v: any) => v.video_id))

      // 신규 영상만 추가
      const newVideos = videoIds
        .filter(vid => !existingIds.has(vid))
        .map((vid, i) => ({
          channel_id: channel.id,
          video_id: vid,
          video_url: `https://www.youtube.com/watch?v=${vid}`,
          title: titles[i] || null,
          published_at: dates[i] || null,
          status: 'pending',
        }))

      if (newVideos.length > 0) {
        await supabase.from('youtube_videos').insert(newVideos)
        newVideoCount = newVideos.length

        // 신규 영상 자동 분석 트리거
        for (const v of newVideos) {
          const { data: inserted } = await supabase
            .from('youtube_videos')
            .select('id')
            .eq('video_id', v.video_id)
            .single()

          if (inserted) {
            // 분석 API 호출 (fire & forget)
            fetch(`${BASE_URL}/api/youtube-analyze`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': CRON_SECRET || '',
              },
              body: JSON.stringify({ videoRowId: inserted.id }),
            }).catch(() => {})
          }
        }
      }

      results.push({
        channel: channel.name,
        newVideos: newVideoCount,
        checked: videoIds.length,
      })
    } catch (err: any) {
      results.push({ channel: channel.name, error: err.message, newVideos: 0 })
    }
  }

  return res.status(200).json({
    success: true,
    syncedAt: new Date().toISOString(),
    results,
  })
}
