import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 60,
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COMPANY = {
  name: '주식회사 글로벌엠디',
  bizNo: '596-87-03305',
  address: '부산광역시 중구 대청로 135, 3층 24-1호 (48931)',
}

const ADMIN_EMAIL = 'okgawoo@gmail.com'
const SLACK_CHANNEL = 'C0ASED4L16V'
const SLACK_BOT_TOKEN = 'xoxb-8679762004994-10885592720434-P3GMN22U4RPCSAb46mTUj7zP'

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}
function getTodayShort() {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const pdfStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 13px; color: #111; line-height: 2.0; padding: 30px 35px; }
  h1 { font-size: 18px; text-align: center; font-weight: 700; margin-bottom: 35px; text-decoration: underline; }
  h2 { font-size: 13px; font-weight: 700; margin-top: 18px; margin-bottom: 8px; }
  p { margin: 5px 0; }
  .section { margin-bottom: 16px; padding: 12px 16px; border: 1px solid #ccc; }
  .label { font-weight: 700; }
  .sign-box { border: 1px solid #999; padding: 6px; min-height: 65px; margin-top: 6px; text-align: center; }
  .sign-box img { max-height: 58px; }
  .date { text-align: center; margin-top: 16px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 5px 10px; border: 1px solid #ddd; font-size: 13px; }
  td:first-child { background: #f5f5f5; font-weight: 700; width: 35%; }
`

function generateAgreementHTML(data: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${pdfStyle}</style></head><body>
  <h1>문자 발신 서비스 이용 동의서</h1>
  <h2>제1조 (서비스 개요)</h2>
  <p>본인 명의 휴대폰 번호로 문자를 발송할 수 있도록 지원하는 서비스입니다.</p>
  <h2>제2조 (개인정보 수집·이용 동의)</h2>
  <p>· 수집 항목: 이름, 생년월일, 주소, 휴대폰 번호</p>
  <p>· 수집 목적: 문자 발신번호 등록 대행 처리</p>
  <p>· 보유 기간: 서비스 해지 후 즉시 파기</p>
  <p>· 동의를 거부할 권리가 있으며, 거부 시 문자 발송 서비스 이용이 불가합니다.</p>
  <h2>제3조 (발신번호 등록 위임 동의)</h2>
  <p>본인 명의 번호의 발신번호 등록 업무를 <span class="label">${COMPANY.name}</span>에 위임합니다.</p>
  <p>· 사업자등록번호: ${COMPANY.bizNo}</p>
  <p>· 이용 목적: 문자메시지 발송 업무</p>
  <p>· 위임 기간: 서비스 이용 기간 중</p>
  <h2>제4조 (이용 제한)</h2>
  <p>· 문자 발송은 업무 목적으로만 사용해야 합니다.</p>
  <p>· 광고성 문자, 스팸, 불법 문자 발송은 엄격히 금지됩니다.</p>
  <p>· 위반 시 서비스가 즉시 해지될 수 있습니다.</p>
  <h2>제5조 (면책)</h2>
  <p>본인의 귀책으로 발생한 법적 문제는 본인이 책임집니다.</p>
  <div class="section" style="margin-top:30px">
    <h2 style="margin-top:0">신청인 정보</h2>
    <table>
      <tr><td>이름</td><td>${data.agentName}</td></tr>
      <tr><td>생년월일</td><td>${data.birthDate}</td></tr>
      <tr><td>주소</td><td>${data.address}</td></tr>
      <tr><td>발신번호</td><td>${data.senderPhone}</td></tr>
    </table>
  </div>
  <p class="date">${getToday()}</p>
  <p style="text-align:center; margin-top:16px">신청인 (서명)</p>
  <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
</body></html>`
}

function generateDelegationHTML(data: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${pdfStyle}</style></head><body>
  <h1>발신번호 위임장</h1>
  <p>□ 용 도 : 발신번호 사전등록</p>
  <p>□ 제 출 처 : ㈜솔라피</p>
  <p>□ 위임내용 : 고객(위임하는 사람)은 ㈜솔라피에서의 발신번호 사전등록 업무 권한 및 발신번호 이용 권한을 대리인에게 위임합니다.</p>
  <div class="section">
    <h2 style="margin-top:0">□ 위탁자 정보 (위임하는 사람)</h2>
    <table>
      <tr><td>위탁자명 (또는 회사명)</td><td>${data.agentName} (인)</td></tr>
      <tr><td>위탁자 식별번호</td><td>${data.birthDate}</td></tr>
      <tr><td>주소</td><td>${data.address}</td></tr>
      <tr><td>위임할 발신번호 목록</td><td>${data.senderPhone}</td></tr>
    </table>
    <p style="margin-top:10px">서명</p>
    <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
  </div>
  <div class="section">
    <h2 style="margin-top:0">□ 수탁자 정보 (위임받는 사람)</h2>
    <table>
      <tr><td>수탁자명 (또는 회사명)</td><td>${COMPANY.name} (인)</td></tr>
      <tr><td>수탁자 식별번호</td><td>${COMPANY.bizNo}</td></tr>
      <tr><td>주소</td><td>${COMPANY.address}</td></tr>
      <tr><td>발신번호 이용 목적</td><td>문자메시지 발송 업무</td></tr>
      <tr><td>위탁자와의 관계</td><td>업무 위탁 계약</td></tr>
    </table>
  </div>
  <p class="date">${getToday()}</p>
</body></html>`
}

function generateContractHTML(data: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${pdfStyle}</style></head><body>
  <h1>개인정보처리 위탁 계약서</h1>
  <p><span class="label">위임자(갑):</span> ${data.agentName} / 생년월일: ${data.birthDate}</p>
  <p><span class="label">수탁자(을):</span> ${COMPANY.name} / 사업자등록번호: ${COMPANY.bizNo}</p>
  <p style="margin-top:8px">"갑"의 개인정보 처리업무를 "을"에게 위탁함에 있어 다음과 같은 내용으로 본 업무위탁계약을 체결합니다.</p>
  <h2>제1조 (목적)</h2>
  <p>"갑"이 개인정보처리업무를 "을"에게 위탁하고, "을"은 이를 승낙하여 성실하게 업무를 완성하도록 하는데 필요한 사항을 정함을 목적으로 합니다.</p>
  <h2>제2조 (위탁업무의 목적 및 범위)</h2>
  <p>"을"은 인터넷을 통한 문자메시지 발송 목적으로 다음의 개인정보 처리 업무를 수행합니다.</p>
  <p>1. 수신자 전화번호</p>
  <p>2. 메시지 내용 (LMS, MMS의 경우 제목 포함)</p>
  <h2>제3조 (재위탁 제한)</h2>
  <p>"을"은 "갑"의 사전 승낙 없이 계약상 권리와 의무 전부 또는 일부를 제3자에게 양도하거나 재위탁할 수 없습니다.</p>
  <h2>제4조 (개인정보의 안전성 확보조치)</h2>
  <p>"을"은 개인정보 보호법 제29조에 따라 안전성 확보에 필요한 기술적·관리적 조치를 취하여야 합니다.</p>
  <h2>제5조 (개인정보의 처리제한)</h2>
  <p>"을"은 위탁 목적 범위를 넘어 개인정보를 이용하거나 제3자에게 제공할 수 없습니다. 계약 종료 시 보유 개인정보를 즉시 파기하거나 "갑"에게 반납하여야 합니다.</p>
  <h2>제6조 (손해배상)</h2>
  <p>"을"이 이 계약에 따른 의무를 위반하여 손해가 발생한 경우 "을"은 그 손해를 배상하여야 합니다.</p>
  <p class="date">${getToday()}</p>
  <table style="margin-top:20px">
    <tr>
      <td style="width:50%; vertical-align:top; padding:14px">
        <p><strong>갑 (위임자)</strong></p>
        <p>이름: ${data.agentName}</p>
        <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
      </td>
      <td style="width:50%; vertical-align:top; padding:14px">
        <p><strong>을 (수탁자)</strong></p>
        <p>${COMPANY.name}</p>
        <p>대표이사 (인)</p>
      </td>
    </tr>
  </table>
</body></html>`
}

async function generatePDF(html: string): Promise<Buffer> {
  let chromium: any
  let puppeteer: any

  try {
    chromium = (await import('@sparticuz/chromium')).default
    puppeteer = (await import('puppeteer-core')).default
  } catch (e) {
    puppeteer = (await import('puppeteer')).default
    chromium = null
  }

  const browser = await puppeteer.launch({
    args: chromium ? chromium.args : [],
    defaultViewport: chromium ? chromium.defaultViewport : { width: 1280, height: 800 },
    executablePath: chromium ? await chromium.executablePath() : undefined,
    headless: true,
  })

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({ format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } })
  await browser.close()
  return Buffer.from(pdf)
}

async function sendSlackNotification(data: any) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` },
    body: JSON.stringify({
      channel: SLACK_CHANNEL,
      text: `📱 DPA 발신번호 등록 신청 | 신청인: ${data.agentName} | 번호: ${data.senderPhone} | 생년월일: ${data.birthDate} | 신청일: ${getTodayShort()} | ✅ Gmail로 서류 3개 발송 완료 → 솔라피(cs@solapi.com) 제출 필요`
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { agentId, agentName, birthDate, address, senderPhone, signatureData } = req.body
  if (!agentId || !agentName || !birthDate || !address || !senderPhone || !signatureData)
    return res.status(400).json({ error: '필수 항목이 누락됐습니다.' })

  try {
    const pdfData = { agentName, birthDate, address, senderPhone, signatureData }
    const agreementPdf = await generatePDF(generateAgreementHTML(pdfData))
    const delegationPdf = await generatePDF(generateDelegationHTML(pdfData))
    const contractPdf = await generatePDF(generateContractHTML(pdfData))

    const prefix = `sms-auth/${agentId}/${Date.now()}`
    await Promise.all([
      supabase.storage.from('dpa-docs').upload(`${prefix}/agreement.pdf`, agreementPdf, { contentType: 'application/pdf', upsert: true }),
      supabase.storage.from('dpa-docs').upload(`${prefix}/delegation.pdf`, delegationPdf, { contentType: 'application/pdf', upsert: true }),
      supabase.storage.from('dpa-docs').upload(`${prefix}/contract.pdf`, contractPdf, { contentType: 'application/pdf', upsert: true }),
    ])

    await supabase.from('dpa_sms_auth').upsert({
      agent_id: agentId, agent_name: agentName, birth_date: birthDate,
      address, sender_phone: senderPhone, signature_data: signatureData,
      status: 'pending',
      doc_url_agreement: `${prefix}/agreement.pdf`,
      doc_url_delegation: `${prefix}/delegation.pdf`,
      doc_url_contract: `${prefix}/contract.pdf`,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `[발신번호 등록] 글로벌엠디 - ${agentName} (${getTodayShort()})`,
      html: `
        <p>안녕하세요, 담당자님.</p>
        <p>주식회사 글로벌엠디 계정의 발신번호 등록을 요청드립니다.</p>
        <br/>
        <h3>📋 등록 요청 정보</h3>
        <table border="1" cellpadding="8" style="border-collapse:collapse">
          <tr><td><b>신청인</b></td><td>${agentName}</td></tr>
          <tr><td><b>등록 요청 발신번호</b></td><td>${senderPhone}</td></tr>
          <tr><td><b>생년월일</b></td><td>${birthDate}</td></tr>
          <tr><td><b>주소</b></td><td>${address}</td></tr>
          <tr><td><b>신청일</b></td><td>${getTodayShort()}</td></tr>
        </table>
        <br/>
        <h3>📎 첨부 서류</h3>
        <ul>
          <li>발신번호 위임장</li>
          <li>개인정보처리 위탁 계약서</li>
          <li>서비스 이용 동의서</li>
        </ul>
        <br/>
        <p>위 서류를 검토하시어 발신번호 등록 처리 부탁드립니다.</p>
        <p>감사합니다.</p>
        <br/>
        <p>주식회사 글로벌엠디</p>
        <p>사업자등록번호: 596-87-03305</p>
        <p>주소: 부산광역시 중구 대청로 135, 3층 24-1호 (48931)</p>
        <br/>
        <p>담당자 : 옥윤철</p>
        <p>모바일 : 010-8846-9776</p>
        <p>이메일 : okgawoo@gmail.com</p>
      `,
      attachments: [
        { filename: `[위임장]_${agentName}_${senderPhone}.pdf`, content: delegationPdf },
        { filename: `[위임관계증명서]_${agentName}_${senderPhone}.pdf`, content: contractPdf },
        { filename: `[동의서]_${agentName}_${senderPhone}.pdf`, content: agreementPdf },
      ]
    })

    await sendSlackNotification(req.body)
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('sms-auth-submit error:', err)
    return res.status(500).json({ error: err.message || '서버 오류가 발생했습니다.' })
  }
}
