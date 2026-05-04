import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const YT_ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w'
const YT_CLIENT_VERSION = '20.10.38'

async function fetchTranscript(videoId: string): Promise<string> {
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

  const playerData = await playerResp.json() as any
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  console.log(`[YT] ${videoId} tracks: ${tracks?.length ?? 0}, playability: ${playerData?.playabilityStatus?.status}`)

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
  if (!text) throw new Error(`Claude 응답 없음`)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : text)
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { videoRowId } = await req.json() as any
  if (!videoRowId) return new Response(JSON.stringify({ error: 'videoRowId 필요' }), { status: 400 })

  const { data: video, error: vErr } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('id', videoRowId)
    .single()

  if (vErr || !video) return new Response(JSON.stringify({ error: '영상을 찾을 수 없습니다' }), { status: 404 })

  await supabase.from('youtube_videos').update({ status: 'analyzing' }).eq('id', videoRowId)

  try {
    let transcript: string
    try {
      transcript = await fetchTranscript(video.video_id)
    } catch (transcriptErr: any) {
      if (transcriptErr?.message?.includes('disabled on this video')) {
        await supabase.from('youtube_videos')
          .update({ status: 'no_transcript', error_message: '자막 비활성화' })
          .eq('id', videoRowId)
        return new Response(JSON.stringify({ success: false, reason: 'no_transcript' }), { status: 200 })
      }
      throw transcriptErr
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

    await supabase.from('youtube_videos')
      .update({ status: 'done', error_message: null })
      .eq('id', videoRowId)

    return new Response(JSON.stringify({ success: true, analysis }), { status: 200 })

  } catch (err: any) {
    await supabase.from('youtube_videos')
      .update({ status: 'error', error_message: err.message })
      .eq('id', videoRowId)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
