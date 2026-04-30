import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
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
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 13px; color: #111; line-height: 1.7; padding: 25px 30px; }
  h1 { font-size: 18px; text-align: center; font-weight: 700; margin-bottom: 20px; text-decoration: underline; }
  h2 { font-size: 13px; font-weight: 700; margin-top: 14px; margin-bottom: 5px; }
  p { margin: 3px 0; }
  .section { margin-bottom: 12px; padding: 10px 14px; border: 1px solid #ccc; }
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
  <h1>아이플래너 문자 발신 서비스 이용 동의서</h1>
  <h2>제1조 (서비스 개요)</h2>
  <p>아이플래너 플랫폼은 설계사 본인 명의 휴대폰 번호로 고객에게 문자를 발송할 수 있도록 지원하는 서비스입니다.</p>
  <h2>제2조 (개인정보 수집·이용 동의)</h2>
  <p>· 수집 항목: 이름, 생년월일, 주소, 휴대폰 번호</p>
  <p>· 수집 목적: 문자 발신번호 등록 대행 처리</p>
  <p>· 보유 기간: 서비스 해지 후 즉시 파기</p>
  <p>· 동의를 거부할 권리가 있으며, 거부 시 문자 발송 서비스 이용이 불가합니다.</p>
  <h2>제3조 (발신번호 등록 위임 동의)</h2>
  <p>본인 명의 번호의 발신번호 등록 업무를 <span class="label">${COMPANY.name}</span>에 위임합니다.</p>
  <p>· 사업자등록번호: ${COMPANY.bizNo}</p>
  <p>· 이용 목적: 아이플래너 플랫폼을 통한 보험 업무 관련 고객 문자 발송</p>
  <p>· 위임 기간: 서비스 이용 기간 중</p>
  <h2>제4조 (이용 제한)</h2>
  <p>· 문자 발송은 보험 업무 목적으로만 사용해야 합니다.</p>
  <p>· 광고성 문자, 스팸, 불법 문자 발송은 엄격히 금지됩니다.</p>
  <p>· 위반 시 서비스가 즉시 해지될 수 있습니다.</p>
  <h2>제5조 (면책)</h2>
  <p>설계사 본인의 귀책으로 발생한 법적 문제는 본인이 책임집니다.</p>
  <div class="section" style="margin-top:16px">
    <h2 style="margin-top:0">신청인 정보</h2>
    <table>
      <tr><td>이름</td><td>${data.agentName}</td></tr>
      <tr><td>생년월일</td><td>${data.birthDate}</td></tr>
      <tr><td>주소</td><td>${data.address}</td></tr>
      <tr><td>발신번호</td><td>${data.senderPhone}</td></tr>
    </table>
  </div>
  <p class="date">${getToday()}</p>
  <p style="text-align:center; margin-top:10px">신청인 (서명)</p>
  <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
</body></html>`
}

function generateDelegationHTML(data: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${pdfStyle}</style></head><body>
  <h1>발신번호 위임장</h1>
  <p>□ 용 도 : 발신번호 사전등록</p>
  <p>□ 제 출 처 : SMS 서비스사</p>
  <p>□ 위임내용 : 고객(위임하는 사람)은 SMS 서비스사에서의 발신번호 사전등록 업무 권한 및 발신번호 이용 권한을 대리인에게 위임합니다.</p>
  <div class="section">
    <h2 style="margin-top:0">□ 위탁자 정보 (위임하는 사람)</h2>
    <table>
      <tr><td>위탁자명 (또는 회사명)</td><td>${data.agentName} (인)</td></tr>
      <tr><td>위탁자 식별번호</td><td>${data.birthDate}</td></tr>
      <tr><td>주소</td><td>${data.address}</td></tr>
      <tr><td>위임할 발신번호 목록</td><td>${data.senderPhone}</td></tr>
    </table>
    <p style="margin-top:8px">서명</p>
    <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
  </div>
  <div class="section">
    <h2 style="margin-top:0">□ 수탁자 정보 (위임받는 사람)</h2>
    <table>
      <tr><td>수탁자명 (또는 회사명)</td><td>${COMPANY.name} (인)</td></tr>
      <tr><td>수탁자 식별번호</td><td>${COMPANY.bizNo}</td></tr>
      <tr><td>주소</td><td>${COMPANY.address}</td></tr>
      <tr><td>발신번호 이용 목적</td><td>아이플래너 플랫폼을 통한 보험 업무 관련 고객 문자 발송</td></tr>
      <tr><td>위탁자와의 관계</td><td>서비스 이용 계약</td></tr>
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
  <p style="margin-top:6px">"갑"의 개인정보 처리업무를 "을"에게 위탁함에 있어 다음과 같은 내용으로 본 업무위탁계약을 체결합니다.</p>
  <h2>제1조 (목적)</h2>
  <p>"갑"이 개인정보처리업무를 "을"에게 위탁하고, "을"은 이를 승낙하여 성실하게 업무를 완성하도록 하는데 필요한 사항을 정함을 목적으로 합니다.</p>
  <h2>제2조 (위탁업무의 목적 및 범위)</h2>
  <p>"을"은 인터넷을 통한 문자메시지 발송 목적으로 다음의 개인정보 처리 업무를 수행합니다.</p>
  <p>1. 수신자 전화번호 &nbsp; 2. 메시지 내용 (LMS, MMS의 경우 제목 포함)</p>
  <h2>제3조 (재위탁 제한)</h2>
  <p>"을"은 "갑"의 사전 승낙 없이 계약상 권리와 의무 전부 또는 일부를 제3자에게 양도하거나 재위탁할 수 없습니다.</p>
  <h2>제4조 (개인정보의 안전성 확보조치)</h2>
  <p>"을"은 개인정보 보호법 제29조에 따라 안전성 확보에 필요한 기술적·관리적 조치를 취하여야 합니다.</p>
  <h2>제5조 (개인정보의 처리제한)</h2>
  <p>"을"은 위탁 목적 범위를 넘어 개인정보를 이용하거나 제3자에게 제공할 수 없습니다. 계약 종료 시 보유 개인정보를 즉시 파기하거나 "갑"에게 반납하여야 합니다.</p>
  <h2>제6조 (손해배상)</h2>
  <p>"을"이 이 계약에 따른 의무를 위반하여 손해가 발생한 경우 "을"은 그 손해를 배상하여야 합니다.</p>
  <p class="date">${getToday()}</p>
  <table style="margin-top:14px">
    <tr>
      <td style="width:50%; vertical-align:top; padding:12px">
        <p><strong>갑 (위임자)</strong></p>
        <p>이름: ${data.agentName}</p>
        <div class="sign-box">${data.signatureData ? `<img src="${data.signatureData}" />` : ''}</div>
      </td>
      <td style="width:50%; vertical-align:top; padding:12px">
        <p><strong>을 (수탁자)</strong></p>
        <p>${COMPANY.name}</p>
        <p>대표이사 (인)</p>
      </td>
    </tr>
  </table>
</body></html>`
}

async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({ format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } })
  await browser.close()
  return Buffer.from(pdf)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { authId } = req.body
  if (!authId) return res.status(400).json({ error: 'authId 필요' })

  try {
    // DB에서 신청 데이터 조회
    const { data: auth, error } = await supabase
      .from('dpa_sms_auth')
      .select('*')
      .eq('id', authId)
      .single()

    if (error || !auth) return res.status(404).json({ error: '신청 데이터를 찾을 수 없습니다.' })

    const pdfData = {
      agentName: auth.agent_name,
      birthDate: auth.birth_date,
      address: auth.address,
      senderPhone: auth.sender_phone,
      signatureData: auth.signature_data,
    }

    // PDF 순차 생성
    const agreementPdf = await generatePDF(generateAgreementHTML(pdfData))
    const delegationPdf = await generatePDF(generateDelegationHTML(pdfData))
    const contractPdf = await generatePDF(generateContractHTML(pdfData))

    // 이메일 발송
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `[주식회사 글로벌엠디] 발신번호 등록 신청 - ${auth.agent_name} (${getTodayShort()})`,
      html: `
        <p>안녕하세요, 담당자님.</p>
        <p>주식회사 글로벌엠디에서 운영 중인 아이플래너 서비스의 발신번호 등록을 요청드립니다.</p>
        <br/>
        <h3>📋 등록 요청 정보</h3>
        <table border="1" cellpadding="8" style="border-collapse:collapse">
          <tr><td><b>신청인</b></td><td>${auth.agent_name}</td></tr>
          <tr><td><b>등록 요청 발신번호</b></td><td>${auth.sender_phone}</td></tr>
          <tr><td><b>생년월일</b></td><td>${auth.birth_date}</td></tr>
          <tr><td><b>주소</b></td><td>${auth.address}</td></tr>
          <tr><td><b>재발송일</b></td><td>${getTodayShort()}</td></tr>
        </table>
        <br/>
        <h3>📎 첨부 서류</h3>
        <ul>
          <li>발신번호 위임장</li>
          <li>개인정보처리 위탁 계약서</li>
          <li>아이플래너 서비스 이용 동의서</li>
        </ul>
        <br/>
        <p>위 서류를 검토하시어 발신번호 등록 처리 부탁드립니다.</p>
        <p>감사합니다.</p>
        <br/>
        <p>주식회사 글로벌엠디</p>
        <p>사업자등록번호: 596-87-03305</p>
        <p>주소: 부산광역시 중구 대청로 135, 3층 24-1호 (48931)</p>
      `,
      attachments: [
        { filename: `[위임장]_${auth.agent_name}_${auth.sender_phone}.pdf`, content: delegationPdf },
        { filename: `[위임관계증명서]_${auth.agent_name}_${auth.sender_phone}.pdf`, content: contractPdf },
        { filename: `[동의서]_${auth.agent_name}_${auth.sender_phone}.pdf`, content: agreementPdf },
      ]
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('sms-auth-resend error:', err)
    return res.status(500).json({ error: err.message || '서버 오류' })
  }
}
