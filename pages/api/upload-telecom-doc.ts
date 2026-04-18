import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_CHANNEL = 'C0ASED4L16V'
const SLACK_BOT_TOKEN = 'xoxb-8679762004994-10885592720434-P3GMN22U4RPCSAb46mTUj7zP'

async function sendSlack(text: string, color: string) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({
      channel: SLACK_CHANNEL,
      attachments: [{ color, text }],
    }),
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)
  const file = Array.isArray(files.file) ? files.file[0] : files.file

  if (!file) return res.status(400).json({ error: '파일이 없습니다.' })

  const agentName = Array.isArray(fields.agentName) ? fields.agentName[0] : fields.agentName || ''
  const birthDate = Array.isArray(fields.birthDate) ? fields.birthDate[0] : fields.birthDate || ''
  const senderPhone = Array.isArray(fields.senderPhone) ? fields.senderPhone[0] : fields.senderPhone || ''

  const fileBuffer = fs.readFileSync(file.filepath)
  const ext = file.originalFilename?.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `telecom-docs/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('dpa-docs')
    .upload(path, fileBuffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) return res.status(500).json({ error: uploadError.message })

  try {
    const isImage = ['jpg', 'jpeg', 'png'].includes(ext)
    const base64 = fileBuffer.toString('base64')
    const mediaType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: isImage ? 'image' : 'document',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `이 문서는 통신서비스 이용증명원입니다. 아래 항목을 검증하고 JSON으로만 답하세요.

검증 항목:
1. 이름: "${agentName}" 과 일치 여부
2. 생년월일: "${birthDate}" 과 일치 여부 (또는 생년월일이 **로 가려져 있는지)
3. 발급일: 오늘(${new Date().toISOString().slice(0, 10)}) 기준 3개월 이내인지
4. 전화번호: "${senderPhone}" 과 일치 여부

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "name_ok": true/false,
  "birth_masked": true/false,
  "birth_ok": true/false,
  "date_ok": true/false,
  "phone_ok": true/false,
  "issues": ["문제 항목 설명 (한국어)"]
}

주의:
- birth_masked가 true면 생년월일이 **로 가려진 것 (재발급 필요)
- issues는 문제 있는 항목만 포함, 없으면 빈 배열`,
              },
            ],
          },
        ],
      }),
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '{}'
    const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim()
    const result = JSON.parse(clean)

    const issues: string[] = result.issues || []
    if (!result.name_ok) issues.push(`이름 불일치 (입력: ${agentName})`)
    if (result.birth_masked) issues.push('생년월일이 가려져 있습니다. 고객센터에 전화하여 재발급 요청하세요.')
    if (!result.birth_ok && !result.birth_masked) issues.push(`생년월일 불일치 (입력: ${birthDate})`)
    if (!result.date_ok) issues.push('발급일이 3개월을 초과했습니다. 새로 발급해주세요.')
    if (!result.phone_ok) issues.push(`전화번호 불일치 (입력: ${senderPhone})`)

    const uniqueIssues = [...new Set(issues)]
    const verified = uniqueIssues.length === 0

    if (verified) {
      await sendSlack(
        `✅ *통신서비스 이용증명원 검증 완료*\n신청인: ${agentName} | 번호: ${senderPhone}\n자동 검증 통과 → 제출 진행 예정`,
        '#1D9E75'
      )
    } else {
      await sendSlack(
        `⚠️ *통신서비스 이용증명원 검증 실패*\n신청인: ${agentName} | 번호: ${senderPhone}\n문제: ${uniqueIssues.join(', ')}`,
        '#E24B4A'
      )
    }

    return res.status(200).json({ url: path, verified, issues: uniqueIssues })

  } catch (e: any) {
    console.error('검증 오류:', e)
    await sendSlack(
      `⚠️ *통신서비스 이용증명원 검증 오류 (수동 확인 필요)*\n신청인: ${agentName} | 번호: ${senderPhone}\n오류: ${e.message}`,
      '#EF9F27'
    )
    return res.status(200).json({ url: path, verified: null, issues: [] })
  }
}
