import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { YoutubeTranscript } from 'youtube-transcript'

export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' })
    return transcript.map(t => t.text).join(' ')
  } catch {
    // 한국어 자막 없으면 기본 언어로 시도
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      return transcript.map(t => t.text).join(' ')
    } catch (err: any) {
      throw new Error(`자막 추출 실패: ${err.message}`)
    }
  }
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

  // API 키 오류 등 에러 응답 체크
  if (data.error) {
    throw new Error(`Claude API 오류: ${data.error.message || JSON.stringify(data.error)}`)
  }

  const text = data.content?.[0]?.text || ''
  if (!text) {
    throw new Error(`Claude 응답 없음: ${JSON.stringify(data)}`)
  }

  // JSON 블록 추출 시도
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

  // 영상 정보 조회
  const { data: video, error: vErr } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('id', videoRowId)
    .single()

  if (vErr || !video) return res.status(404).json({ error: '영상을 찾을 수 없습니다' })

  // 분석중 상태로 변경
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
      // 자막 비활성화 / 접근 불가 → no_transcript 처리 (팝업 없이 조용히)
      if (
        msg.includes('disabled') ||
        msg.includes('Transcript') ||
        msg.includes('transcript') ||
        msg.includes('Could not find') ||
        msg.includes('not available')
      ) {
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

    // 3. 기존 분석 결과 삭제 후 저장
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

    // 4. 완료 상태
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
