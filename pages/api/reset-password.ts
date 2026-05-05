import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username } = req.body
  if (!username) return res.status(400).json({ error: '아이디를 입력해주세요.' })

  // 1. dpa_agents에서 email(auth용) + personal_email(수신용) 조회
  const { data: agent } = await supabaseAdmin
    .from('dpa_agents')
    .select('name, email, personal_email')
    .eq('slug', username.trim())
    .single()

  if (!agent) {
    return res.status(404).json({ error: '해당 아이디로 가입된 계정이 없어요.' })
  }

  // 수신 이메일: personal_email 우선, 없으면 auth email
  const sendTo = agent.personal_email || agent.email
  if (!sendTo || sendTo.endsWith('@dpa.com')) {
    return res.status(400).json({ error: '등록된 이메일이 없어요. 관리자에게 문의해주세요.' })
  }

  // 2. Supabase Admin으로 recovery 링크 생성 (auth email 기준)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://globalmd-dpa.vercel.app'
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: agent.email,   // 실제 auth 이메일 (신규: personal_email, 기존: @dpa.com)
    options: { redirectTo: `${siteUrl}/settings` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink error:', linkError)
    return res.status(500).json({ error: '링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.' })
  }

  // 3. Gmail로 발송 (수신 이메일 = personal_email)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.IPLANNER_GMAIL_USER, pass: process.env.IPLANNER_GMAIL_APP_PASSWORD },
  })

  await transporter.sendMail({
    from: `아이플래너 <help@iplanner.kr>`,
    to: sendTo,
    subject: '[아이플래너] 비밀번호 재설정 링크',
    html: `
      <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:#5E6AD2;color:#fff;font-size:13px;font-weight:700;padding:6px 16px;border-radius:999px;letter-spacing:0.04em;">아이플래너</div>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin:0 0 8px;">비밀번호를 재설정해 드릴게요</h2>
        <p style="font-size:14px;color:#636B78;line-height:1.7;margin:0 0 28px;">
          안녕하세요 <strong>${agent.name}</strong>님,<br/>
          아래 버튼을 클릭하면 새 비밀번호를 설정할 수 있어요.<br/>
          링크는 <strong>1시간</strong> 동안만 유효해요.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${linkData.properties.action_link}" style="display:inline-block;background:#5E6AD2;color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;">
            비밀번호 재설정하기
          </a>
        </div>
        <p style="font-size:12px;color:#9CA3AF;line-height:1.6;margin:0 0 8px;">
          비밀번호 변경 후에는 <strong style="color:#5E6AD2;">설정 → 내 정보</strong> 에서도 언제든지 변경할 수 있어요.
        </p>
        <p style="font-size:12px;color:#9CA3AF;line-height:1.6;margin:0;">
          본인이 요청하지 않으셨다면 이 이메일을 무시하세요.<br/>
          문의: help@iplanner.kr
        </p>
      </div>
    `,
  })

  return res.status(200).json({ ok: true, email: sendTo })
}
