import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YT_API_KEY = process.env.YOUTUBE_API_KEY

// UC → UU 변환 (업로드 재생목록 ID)
function getUploadsPlaylistId(channelId: string) {
  return channelId.replace(/^UC/, 'UU')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { channelRowId } = req.body
  if (!channelRowId) return res.status(400).json({ error: 'channelRowId 필요' })
  if (!YT_API_KEY) return res.status(500).json({ error: 'YOUTUBE_API_KEY 환경변수 없음' })

  // 채널 정보 조회
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('id', channelRowId)
    .single()

  if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다' })

  // channel_url에서 채널 ID 추출 (URL이 /channel/UC... 형태이거나 핸들 형태)
  let channelId = ''
  const channelMatch = channel.channel_url.match(/channel\/(UC[a-zA-Z0-9_-]+)/)
  if (channelMatch) {
    channelId = channelMatch[1]
  } else {
    // 핸들(@...) 형태 → YouTube API로 채널 ID 조회
    const handle = channel.handle?.replace('@', '') || ''
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YT_API_KEY}`
    )
    const searchData = await searchRes.json()
    channelId = searchData.items?.[0]?.id || ''
  }

  if (!channelId) return res.status(400).json({ error: '채널 ID를 찾을 수 없습니다' })

  const uploadsPlaylistId = getUploadsPlaylistId(channelId)

  // 기존 video_id 목록 조회 (중복 방지)
  const { data: existingVideos } = await supabase
    .from('youtube_videos')
    .select('video_id')
    .eq('channel_id', channelRowId)

  const existingIds = new Set((existingVideos || []).map((v: any) => v.video_id))

  let newCount = 0
  let totalFetched = 0
  let pageToken = ''

  // 페이지네이션으로 전체 영상 수집
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('playlistId', uploadsPlaylistId)
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('key', YT_API_KEY)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const ytRes = await fetch(url.toString())
    const ytData = await ytRes.json()

    if (ytData.error) {
      return res.status(500).json({ error: ytData.error.message })
    }

    const items = ytData.items || []
    totalFetched += items.length

    // 새 영상만 필터링
    const newVideos = items
      .filter((item: any) => {
        const vid = item.snippet?.resourceId?.videoId
        return vid && !existingIds.has(vid)
      })
      .map((item: any) => ({
        channel_id: channelRowId,
        video_id: item.snippet.resourceId.videoId,
        video_url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
        title: item.snippet.title,
        published_at: item.snippet.publishedAt?.split('T')[0] || null,
        status: 'pending',
      }))

    // 50개씩 배치 삽입
    if (newVideos.length > 0) {
      await supabase.from('youtube_videos').insert(newVideos)
      newCount += newVideos.length
      newVideos.forEach((v: any) => existingIds.add(v.video_id))
    }

    pageToken = ytData.nextPageToken || ''
  } while (pageToken)

  // 채널 구독자 수 업데이트
  try {
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YT_API_KEY}`
    )
    const chData = await chRes.json()
    const stats = chData.items?.[0]?.statistics
    if (stats) {
      const subCount = parseInt(stats.subscriberCount || '0')
      const subLabel = subCount >= 10000
        ? `${Math.round(subCount / 10000)}만명`
        : `${subCount.toLocaleString()}명`
      await supabase
        .from('youtube_channels')
        .update({ subscriber_count: subLabel, updated_at: new Date().toISOString() })
        .eq('id', channelRowId)
    }
  } catch {}

  return res.status(200).json({
    success: true,
    totalFetched,
    newCount,
    channelId,
  })
}
