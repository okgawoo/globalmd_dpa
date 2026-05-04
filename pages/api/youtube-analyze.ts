import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YT_ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w'
const YT_CLIENT_VERSION = '20.10.38'

// InnerTube ANDROID API로 자막 URL 가져오기 (라이브러리 불필요)
async function fetchTranscript(videoId: string): Promise<string> {
  // 1. InnerTube ANDROID API 호출
  const playerResp = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${YT_ANDROID_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `com.google.android.youtube/${YT_CLIENT_VERSION} (Linux; U; Android 14) gzip`,
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': YT_CLIENT_VERSION,
        'X-Goog-Api-Key': YT_ANDROID_KEY,
        'Accept': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: YT_CLIENT_VERSION,
            androidSdkVersion: 34,
            hl: 'ko',
            gl: 'KR',
          },
        },
        videoId,
        racyCheckOk: true,
        contentCheckOk: true,
      }),
    }
  )

  if (!playerResp.ok) {
    throw new Error(`InnerTube 요청 실패: ${playerResp.status}`)
  }

  const playerData = await playerResp.json()
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  // 디버깅 로그
  console.log(`[YT] ${videoId} InnerTube status: ${playerResp.status}, tracks: ${tracks?.length ?? 0}, playability: ${playerData?.playabilityStatus?.status}`)
  if (!Array.isArray(tracks) || tracks.length === 0) {
    console.log(`[YT] ${videoId} no tracks — reason: ${JSON.stringify(playerData?.playabilityStatus)}`)
    throw new Error(`disabled on this video (${videoId})`)
  }

  // 2. 한국어 자막 우선, 없으면 첫 번째
  const koTrack = tracks.find((t: any) => t.languageCode === 'ko') || tracks[0]
  const baseUrl = koTrack.baseUrl

  if (!baseUrl) {
    throw new Error(`disabled on this video (${videoId})`)
  }

  // 3. 자막 XML 가져오기
  const xmlResp = await fetch(baseUrl)
  if (!xmlResp.ok) {
    throw new Error(`자막 XML 요청 실패: ${xmlResp.status}`)
  }
  const xml = await xmlResp.text()

  // 4. XML 파싱 — 새 포맷 <p t="ms"><s>text</s></p> 처리
  const segments: string[] = []

  // srv3 형식: <p t="..." d="..."><s ac="0">텍스트</s></p>
  const pRegex = /<p\s+t="\d+"[^>]*>([\s\S]*?)<\/p>/g
  const sRegex = /<s[^>]*>([^<]*)<\/s>/g
  let pMatch

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const inner = pMatch[1]
    const words: string[] = []
    let sMatch
    const sRe = new RegExp(sRegex.source, 'g')
    while ((sMatch = sRe.exec(inner)) !== null) {
      const word = sMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
      if (word) words.push(word)
    }
    if (words.length > 0) segments.push(words.join(''))
  }

  // 구형 포맷 fallback: <text start="..." dur="...">텍스트</text>
  if (segments.length === 0) {
    const textRegex = /<text[^>]*>([^<]*)<\/text>/g
    let tMatch
    while ((tMatch = textRegex.exec(xml)) !== null) {
      const word = tMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
      if (word) segments.push(word)
    }
  }

  if (segments.length === 0) {
    throw new Error(`disabled on this video (${videoId})`)
  }

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
  "key_points": [
    "핵심 포인트 1",
    "핵심 포인트 2",
    "핵심 포인트 3"
  ],
  "pitch_points": [
    "설계사가 고객에게 써먹을 수 있는 피칭 포인트 1",
    "피칭 포인트 2",
    "피칭 포인트 3"
  ],
  "scripts": [
    "실제 화법 예시 문장 1",
    "실제 화법 예시 문장 2",
    "실제 화법 예시 문장 3"
  ],
  "comparison_criteria": [
    "비교 기준 1 (예: 남자→메리츠, 여자→DB손보)",
    "비교 기준 2"
  ]
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

  const data = await res.json()

  if (data.error) {
    throw new Error(`Claude API 오류: ${data.error.message || JSON.stringify(data.error)}`)
  }

  const text = data.content?.[0]?.text || ''
  if (!text) {
    throw new Error(`Claude 응답 없음: ${JSON.stringify(data)}`)
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : text

  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error(`Claude 응답 파싱 실패: ${text.slice(0, 200)}`)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { videoRowId } = req.body
  if (!videoRowId) return res.status(400).json({ error: 'videoRowId 필요' })

  const { data: video, error: vErr } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('id', videoRowId)
    .single()

  if (vErr || !video) return res.status(404).json({ error: '영상을 찾을 수 없습니다' })

  await supabase
    .from('youtube_videos')
    .update({ status: 'analyzing' })
    .eq('id', videoRowId)

  try {
    // 1. 자막 추출
    let transcript: string
    try {
      transcript = await fetchTranscript(video.video_id)
    } catch (transcriptErr: any) {
      const msg = transcriptErr?.message || ''
      if (msg.includes('disabled on this video')) {
        await supabase
          .from('youtube_videos')
          .update({ status: 'no_transcript', error_message: '자막 비활성화' })
          .eq('id', videoRowId)
        return res.status(200).json({ success: false, reason: 'no_transcript' })
      }
      throw transcriptErr
    }

    // 2. Claude 분석
    const analysis = await analyzeWithClaude(transcript, video.title || video.video_url)

    // 3. 분석 결과 저장
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

    // 4. 완료
    await supabase
      .from('youtube_videos')
      .update({ status: 'done', error_message: null })
      .eq('id', videoRowId)

    return res.status(200).json({ success: true, analysis })

  } catch (err: any) {
    await supabase
      .from('youtube_videos')
      .update({ status: 'error', error_message: err.message })
      .eq('id', videoRowId)

    return res.status(500).json({ error: err.message })
  }
}
