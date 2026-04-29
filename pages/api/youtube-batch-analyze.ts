import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://globalmd-dpa.vercel.app'
const BATCH_SIZE = 3 // 한 번에 분석할 영상 수 (타임아웃 방지)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { channelId } = req.body // 특정 채널만 처리하거나 전체 처리

  // pending 영상 최신순으로 BATCH_SIZE개 가져오기
  let query = supabase
    .from('youtube_videos')
    .select('id, video_id, title, channel_id')
    .eq('status', 'pending')
    .order('published_at', { ascending: false })
    .limit(BATCH_SIZE)

  if (channelId) query = query.eq('channel_id', channelId)

  const { data: pending } = await query

  if (!pending || pending.length === 0) {
    // 남은 pending 수 확인
    let countQuery = supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    if (channelId) countQuery = countQuery.eq('channel_id', channelId)
    const { count } = await countQuery
    return res.status(200).json({ done: true, remaining: 0, processed: 0 })
  }

  // 분석 상태로 먼저 마킹
  await supabase
    .from('youtube_videos')
    .update({ status: 'analyzing' })
    .in('id', pending.map(v => v.id))

  // 순차 분석 (병렬로 하면 rate limit 위험)
  const results: { id: string; title: string; success: boolean; error?: string }[] = []

  for (const video of pending) {
    try {
      const analyzeRes = await fetch(`${BASE_URL}/api/youtube-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoRowId: video.id }),
      })
      const analyzeData = await analyzeRes.json()
      results.push({
        id: video.id,
        title: video.title || video.video_id,
        success: !analyzeData.error,
        error: analyzeData.error,
      })
    } catch (e: any) {
      await supabase.from('youtube_videos').update({ status: 'error', error_message: e.message }).eq('id', video.id)
      results.push({ id: video.id, title: video.title || video.video_id, success: false, error: e.message })
    }
  }

  // 남은 pending 수
  let remainingQuery = supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (channelId) remainingQuery = remainingQuery.eq('channel_id', channelId)
  const { count: remaining } = await remainingQuery

  return res.status(200).json({
    done: (remaining || 0) === 0,
    processed: results.length,
    remaining: remaining || 0,
    results,
  })
}
