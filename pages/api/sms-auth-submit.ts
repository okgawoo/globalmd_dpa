import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import jsPDF from 'jspdf'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 글로벌엠디 법인 정보
const COMPANY = {
  name: '주식회사 글로벌엠디',
  bizNo: '596-87-03305',
  address: '부산광역시 중구 대청로 135, 3층 24-1호 (48931)',
}

const ADMIN_EMAIL = 'okgawoo@gmail.com'
const SLACK_CHANNEL = 'C0ASED4L16V'

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
function getTodayShort() {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// PDF 한글 지원 - 기본 폰트로 영문/숫자 처리, 한글은 이미지로
async function generateAgreementPDF(data: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, L = 15, R = 195, lh = 7

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('DPA SMS Service Agreement', W / 2, 25, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  let y = 40
  const line = (text: string, indent = 0) => {
    doc.text(text, L + indent, y)
    y += lh
  }

  line('[ SMS Sending Service Terms Agreement ]')
  y += 3
  line('Article 1. Service Overview')
  line('DPA platform provides SMS sending service using the agent\'s own phone number.', 4)
  y += 3
  line('Article 2. Personal Information Collection & Usage Consent')
  line('- Collection: Name, Date of Birth, Address, Phone Number', 4)
  line('- Purpose: Phone number registration for SMS service', 4)
  line('- Retention: Deleted upon service termination', 4)
  y += 3
  line('Article 3. Phone Number Delegation Consent')
  line('The agent delegates phone number registration to GlobalMD Co., Ltd.', 4)
  line(`- Company: ${COMPANY.name}`, 4)
  line(`- Biz No: ${COMPANY.bizNo}`, 4)
  line(`- Purpose: SMS sending via DPA platform for insurance business`, 4)
  y += 3
  line('Article 4. Usage Restrictions')
  line('- SMS must be used for insurance business purposes only', 4)
  line('- Spam or illegal SMS is strictly prohibited', 4)
  line('- Violation may result in immediate service termination', 4)
  y += 3
  line('Article 5. Disclaimer')
  line('Legal issues caused by the agent\'s own fault are the agent\'s responsibility.', 4)
  y += 5

  line('[ Agent Information ]')
  line(`Name: ${data.agentName}`)
  line(`Date of Birth: ${data.birthDate}`)
  line(`Phone Number: ${data.senderPhone}`)
  line(`Address: ${data.address}`)
  line(`Date: ${getTodayShort()}`)
  y += 5

  line('[ Signature ]')
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', L, y, 60, 25)
      y += 30
    } catch (e) { y += 30 }
  }
  line('Agent (Signed above)')

  return Buffer.from(doc.output('arraybuffer'))
}

async function generateDelegationPDF(data: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, L = 15, lh = 7

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Phone Number Delegation Letter', W / 2, 30, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  let y = 50
  const line = (text: string, indent = 0) => {
    doc.text(text, L + indent, y)
    y += lh
  }

  line('Purpose: Phone Number Pre-Registration')
  line('Submitted to: Solapi')
  y += 3
  line('Delegation Content:')
  line('The delegating party delegates the phone number pre-registration authority', 4)
  line('and usage rights to the delegatee.', 4)
  y += 5

  line('[ Delegating Party (Agent) ]')
  line(`Name: ${data.agentName}`)
  line(`Date of Birth: ${data.birthDate}`)
  line(`Address: ${data.address}`)
  line(`Phone Number to Delegate: ${data.senderPhone}`)
  y += 3

  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', L, y, 50, 20)
      y += 25
    } catch (e) { y += 25 }
  }
  line('Signature: (signed above)')
  y += 5

  line('[ Delegatee (Company) ]')
  line(`Company: ${COMPANY.name}`)
  line(`Biz No: ${COMPANY.bizNo}`)
  line(`Address: ${COMPANY.address}`)
  line('Purpose: SMS sending service via DPA platform')
  line('Relationship: Service provider')
  y += 5

  line(`Date: ${getToday()}`)

  return Buffer.from(doc.output('arraybuffer'))
}

async function generateContractPDF(data: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, L = 15, lh = 7

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Personal Information Processing Entrustment Contract', W / 2, 25, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  let y = 40
  const line = (text: string, indent = 0) => {
    const lines = doc.splitTextToSize(text, 175 - indent)
    doc.text(lines, L + indent, y)
    y += lh * lines.length
  }

  line(`"GAP" (Agent): ${data.agentName} / DOB: ${data.birthDate}`)
  line(`"EUL" (Trustee): ${COMPANY.name} / Biz No: ${COMPANY.bizNo}`)
  y += 3
  line('Article 1. Purpose')
  line('"GAP" entrusts personal information processing to "EUL" for SMS sending service.', 4)
  y += 2
  line('Article 2. Scope of Entrusted Work')
  line('1. Recipient phone numbers', 4)
  line('2. Message content (including title for LMS/MMS)', 4)
  y += 2
  line('Article 3. Re-entrustment Restriction')
  line('"EUL" may not transfer or re-entrust rights without prior consent of "GAP".', 4)
  y += 2
  line('Article 4. Security Measures')
  line('"EUL" shall implement necessary technical and managerial measures per Personal', 4)
  line('Information Protection Act Article 29.', 4)
  y += 2
  line('Article 5. Processing Restriction')
  line('"EUL" shall not use personal information beyond the entrusted scope.', 4)
  line('Upon contract termination, all personal information shall be immediately destroyed.', 4)
  y += 2
  line('Article 6. Liability')
  line('"EUL" shall compensate for damages caused by violation of this contract.', 4)
  y += 5

  line(`Date: ${getToday()}`)
  y += 3
  line(`GAP: ${data.agentName}`)
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', L, y, 50, 20)
      y += 25
    } catch (e) { y += 25 }
  }
  line('Signature: (signed above)')
  y += 3
  line(`EUL: ${COMPANY.name}`)
  line(`Representative: (Company Seal)`)

  return Buffer.from(doc.output('arraybuffer'))
}

async function sendSlackNotification(data: any, agentId: string) {
  const message = {
    channel: SLACK_CHANNEL,
    text: `📱 *[DPA 발신번호 등록 신청]*\n설계사: ${data.agentName}\n번호: ${data.senderPhone}\n생년월일: ${data.birthDate}\n주소: ${data.address}\n신청일: ${getTodayShort()}\n\n서류 3개가 okgawoo@gmail.com으로 발송됐어요.\n솔라피(cs@solapi.com)에 이메일로 서류를 제출해주세요!`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📱 DPA 발신번호 등록 신청' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*설계사:*\n${data.agentName}` },
          { type: 'mrkdwn', text: `*발신번호:*\n${data.senderPhone}` },
          { type: 'mrkdwn', text: `*생년월일:*\n${data.birthDate}` },
          { type: 'mrkdwn', text: `*신청일:*\n${getTodayShort()}` },
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '✅ 서류 3개가 Gmail로 발송됐습니다.\n솔라피(cs@solapi.com)에 이메일로 제출해주세요!' }
      }
    ]
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
    },
    body: JSON.stringify(message)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { agentId, agentName, birthDate, address, senderPhone, signatureData } = req.body

  if (!agentId || !agentName || !birthDate || !address || !senderPhone || !signatureData) {
    return res.status(400).json({ error: '필수 항목이 누락됐습니다.' })
  }

  try {
    // PDF 3개 생성
    const pdfData = { agentName, birthDate, address, senderPhone, signatureData }
    const [agreementPdf, delegationPdf, contractPdf] = await Promise.all([
      generateAgreementPDF(pdfData),
      generateDelegationPDF(pdfData),
      generateContractPDF(pdfData),
    ])

    // Supabase Storage 저장
    const prefix = `sms-auth/${agentId}/${Date.now()}`
    await Promise.all([
      supabase.storage.from('dpa-docs').upload(`${prefix}/agreement.pdf`, agreementPdf, { contentType: 'application/pdf' }),
      supabase.storage.from('dpa-docs').upload(`${prefix}/delegation.pdf`, delegationPdf, { contentType: 'application/pdf' }),
      supabase.storage.from('dpa-docs').upload(`${prefix}/contract.pdf`, contractPdf, { contentType: 'application/pdf' }),
    ])

    // DB 저장
    await supabase.from('dpa_sms_auth').insert({
      agent_id: agentId,
      agent_name: agentName,
      birth_date: birthDate,
      address,
      sender_phone: senderPhone,
      signature_data: signatureData,
      status: 'pending',
      doc_url_agreement: `${prefix}/agreement.pdf`,
      doc_url_delegation: `${prefix}/delegation.pdf`,
      doc_url_contract: `${prefix}/contract.pdf`,
    })

    // 이메일 발송
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      }
    })

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `[DPA 발신번호 신청] ${agentName} 설계사 - ${senderPhone} (${getTodayShort()})`,
      html: `
        <h2>📱 DPA 발신번호 등록 신청</h2>
        <table border="1" cellpadding="8" style="border-collapse:collapse">
          <tr><td><b>설계사</b></td><td>${agentName}</td></tr>
          <tr><td><b>발신번호</b></td><td>${senderPhone}</td></tr>
          <tr><td><b>생년월일</b></td><td>${birthDate}</td></tr>
          <tr><td><b>주소</b></td><td>${address}</td></tr>
          <tr><td><b>신청일</b></td><td>${getTodayShort()}</td></tr>
        </table>
        <br/>
        <p>📎 첨부 서류 3개를 솔라피(cs@solapi.com)로 제출해주세요.</p>
        <p>라벨: <b>DPA/발신번호신청</b></p>
      `,
      attachments: [
        { filename: `[동의서]_${agentName}_${senderPhone}.pdf`, content: agreementPdf },
        { filename: `[위임장]_${agentName}_${senderPhone}.pdf`, content: delegationPdf },
        { filename: `[위임관계증명서]_${agentName}_${senderPhone}.pdf`, content: contractPdf },
      ]
    })

    // 슬랙 알림
    await sendSlackNotification(req.body, agentId)

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('sms-auth-submit error:', err)
    return res.status(500).json({ error: err.message || '서버 오류가 발생했습니다.' })
  }
}
