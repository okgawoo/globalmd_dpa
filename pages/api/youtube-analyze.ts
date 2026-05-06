import { createClient } from '@supabase/supabase-js'
import { YoutubeTranscript } from 'youtube-transcript'

// Edge 런타임 제거 → Node.js 서버리스 사용 (더 긴 타임아웃 + 패키지 호환)

async function fetchTranscript(videoId: string): Promise<string> {
  // 1차: youtube-transcript 패키지 (가장 안정적)
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' })
    if (segments && segments.length > 0) {
      return segments.map((s: any) => s.text).join(' ')
    }
    // 한국어 자막 없으면 기본 언어로 재시도
    const fallback = await YoutubeTranscript.fetchTranscript(videoId)
    if (fallback && fallback.length > 0) {
      return fallback.map((s: any) => s.text).join(' ')
    }
  } catch (e: any) {
    // 자막 비활성화 또는 없음
    if (
      e?.message?.includes('disabled') ||
      e?.message?.includes('No transcript') ||
      e?.message?.includes('Could not get')
    ) {
      throw new Error(`disabled on this video (${videoId})`)
    }
    // 그 외 에러 → 2차 방법 시도
    console.warn(`[YT] youtube-transcript 실패, HTML 파싱 시도: ${e?.message}`)
  }

  // 2차 fallback: HTML 직접 파싱 (구형 방식)
  const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  const html = await pageResp.text()

  if (!html.includes('"captionTracks"')) {
    throw new Error(`disabled on this video (${videoId})`)
  }

  // ytInitialPlayerResponse 추출 (여러 토큰 형식 시도)
  const tokens = [
    'var ytInitialPlayerResponse = ',
    'var ytInitialPlayerResponse=',
    'ytInitialPlayerResponse = ',
    'ytInitialPlayerResponse=',
  ]

  let startIdx = -1
  let tokenLen = 0
  for (const token of tokens) {
    const idx = html.indexOf(token)
    if (idx !== -1) { startIdx = idx; tokenLen = token.length; break }
  }

  if (startIdx === -1) throw new Error(`disabled on this video (${videoId})`)

  const jsonStart = startIdx + tokenLen
  let depth = 0
  let jsonEnd = jsonStart
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}') {
      depth--
      if (depth === 0) { jsonEnd = i + 1; break }
    }
  }

  const playerResponse = JSON.parse(html.slice(jsonStart, jsonEnd))
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error(`disabled on this video (${videoId})`)
  }

  const koTrack = tracks.find((t: any) => t.languageCode === 'ko') || tracks[0]
  const baseUrl = koTrack.baseUrl
  const xmlResp = await fetch(baseUrl)
  const xml = await xmlResp.text()

  const segments: string[] = []
  const pRegex = /<p\s+t="\d+"[^>]*>([\s\S]*?)<\/p>/g
  let pMatch
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const words: string[] = []
    const sRe = /<s[^>]*>([^<]*)<\/s>/g
    let sMatch
    while ((sMatch = sRe.exec(pMatch[1])) !== null) {
      const w = sMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
      if (w) words.push(w)
    }
    if (words.length) segments.push(words.join(''))
  }

  if (segments.length === 0) {
    const textRegex = /<text[^>]*>([^<]*)<\/text>/g
    let tMatch
    while ((tMatch = textRegex.exec(xml)) !== null) {
      const w = tMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim()
      if (w) segments.push(w)
    }
  }

  if (segments.length === 0) throw new Error(`disabled on this video (${videoId})`)
  return segments.join(' ')
}

async function analyzeWithClaude(transcript: string, title: string): Promise<any> {
  const prompt = `다음은 보험 설계사 유튜브 채널의 영상 자막입니다.
영상 제목: ${title}

자막 내용:
${transcript.slice(0, 8000)}

위 내용을 분석하여 아래 JSON 형식으로 정확히 응답해주세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{
  "summary": "영상 핵심 내용 2~3문장 요약",
  "key_points": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "pitch_points": ["피칭 포인트 1", "피칭 포인트 2", "피칭 포인트 3"],
  "scripts": ["화법 예시 1", "화법 예시 2", "화법 예시 3"],
  "comparison_criteria": ["비교 기준 1", "비교 기준 2"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json() as any
  if (data.error) throw new Error(`Claude API 오류: ${data.error.message}`)
  const text = data.content?.[0]?.text || ''
  if (!text) throw new Error('Claude 응답 없음')
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : text)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { videoRowId } = req.body
  if (!videoRowId) return res.status(400).json({ error: 'videoRowId 필요' })

  const { data: video } = await supabase.from('youtube_videos').select('*').eq('id', videoRowId).single()
  if (!video) return res.status(404).json({ error: '영상 없음' })

  await supabase.from('youtube_videos').update({ status: 'analyzing' }).eq('id', videoRowId)

  try {
    let transcript: string
    try {
      transcript = await fetchTranscript(video.video_id)
    } catch (e: any) {
      if (e?.message?.includes('disabled on this video')) {
        await supabase.from('youtube_videos').update({ status: 'no_transcript', error_message: '자막 비활성화' }).eq('id', videoRowId)
        return res.status(200).json({ success: false, reason: 'no_transcript' })
      }
      throw e
    }

    const analysis = await analyzeWithClaude(transcript, video.title || video.video_url)

    await supabase.from('youtube_analyses').delete().eq('video_id', videoRowId)
    await supabase.from('youtube_analyses').insert([{
      video_id: videoRowId,
      summary: analysis.summary,
      key_points: analysis.key_points,
      pitch_points: analysis.pitch_points,
      scripts: analysis.scripts,
      comparison_criteria: analysis.comparison_criteria,
      raw_transcript: transcript.slice(0, 5000),
    }])

    await supabase.from('youtube_videos').update({ status: 'done', error_message: null }).eq('id', videoRowId)
    return res.status(200).json({ success: true, analysis })

  } catch (err: any) {
    await supabase.from('youtube_videos').update({ status: 'error', error_message: err.message }).eq('id', videoRowId)
    return res.status(500).json({ error: err.message })
  }
}
