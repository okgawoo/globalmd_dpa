import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text) return res.status(400).json({ error: '텍스트가 없어요!' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키가 없어요!' })

  const systemPrompt = `당신은 보험 데이터 파싱 전문가입니다.
입력된 보험 보장 내역 텍스트를 분석하여 아래 JSON 형식으로 정확하게 반환하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요.

중요 파싱 규칙:
1. 이름: 텍스트에서 주민번호 바로 앞 또는 "OOO님" 형식의 한글 이름을 찾으세요.
2. 주민등록번호: XXXXXX-XXXXXXX 형식. 뒷자리 첫번째 숫자로 성별(1,3→남/2,4→여) 판단. 나이는 반드시 현재연도 2026에서 출생연도를 빼서 계산 (예: 730108 → 1973년생 → 2026-1973=53세).
3. 연락처: 010으로 시작하는 번호를 010-XXXX-XXXX 형식으로 변환.
4. 주소: 광역시/도 + 구/군으로 시작하는 전체 주소 (동/호수까지).
5. 직업: "공무원", "직장인", "교사", "의사" 등 직업명을 직접 찾거나, 직장명에서 유추 (시청→공무원, 병원→의료인).
6. 직장/소속: 회사명, 기관명 전체 (예: 울산광역시청, 삼성전자).
7. 계좌: 은행명과 계좌번호를 반드시 분리. bank_name=은행명만, bank_account=숫자+하이픈만. 공백으로 구분된 계좌번호도 하이픈으로 변환 (예: 1002 3628 09746 → 1002-3628-09746).
8. 운전면허: "운전면허" 뒤에 오는 번호 또는 XX-XX-XXXXXX-XX 형식.
9. 보험료: 숫자,숫자원 형식 (예: 54,160원 → 54160).
10. 금액 변환: 1억=100000000, 1천만=10000000, 5천만=50000000, 2억=200000000, 1백만=1000000, 1만=10000, 1천=1000.
11. 보험사명 추출 및 변환 (반드시 준수):

    [Step 1 — 텍스트에서 보험사명 직접 추출]
    - 텍스트 최상단 또는 각 계약 블록 첫 줄에서 보험사명을 먼저 찾으세요.
    - 아래 인식 키워드가 텍스트에 포함되어 있으면 해당 보험사로 확정합니다.

    [생명보험사 인식 키워드 → 최종 보험사명]
    - 삼성생명, 삼성 (생명 맥락) → 삼성생명
    - 한화생명, 한화, 매일아침굿모닝, PLUS (한화 상품) → 한화생명
    - 교보생명, 교보 → 교보생명
    - 신한라이프, 신한생명 → 신한라이프
    - AIA → AIA생명
    - 흥국생명 → 흥국생명
    - DB생명, 동부생명 → DB생명
    - 푸본현대, 현대라이프 → 푸본현대생명
    - 하나생명 → 하나생명
    - KDB생명, 산은생명 → KDB생명
    - ABL생명, 알리안츠 → ABL생명
    - 동양생명, 동양 → 동양생명
    - 미래에셋생명 → 미래에셋생명
    - NH생명, 농협생명 → NH농협생명
    - iM라이프, DGB생명 → iM라이프
    - 메트라이프 → 메트라이프
    - 처브라이프 → 처브라이프
    - 라이나생명, 라이나 → 라이나생명
    - PCA생명, PCA → PCA생명
    - 유니버셜생명 → 유니버셜생명
    - IBK연금보험, IBK생명, IBK연금, IBK → IBK연금보험

    [손해보험사 인식 키워드 → 최종 보험사명]
    - 삼성화재 → 삼성화재
    - 현대해상, 하이콜, Hi (현대 맥락) → 현대해상
    - KB손해보험, KB손해, KB다이렉트 → KB손해보험
    - DB손해보험, DB손해, 동부화재 → DB손해보험
    - 메리츠화재, 메리츠 → 메리츠화재
    - 롯데손해보험, 롯데, let:drive → 롯데손해보험
    - 한화손해보험, 한화손해 → 한화손해보험
    - MG손해보험, MG새마을금고, 새마을금고, MG, 無MG, 무MG, 행복드림보장공제, 종신암공제 → MG손해보험
    - 흥국화재 → 흥국화재
    - NH손해, 농협손해 → NH농협손해보험
    - AIG손해보험, AIG → AIG손해보험
    - AXA → AXA손해보험
    - 하나손해 → 하나손해보험
    - 캐롯 → 캐롯손해보험

    [Step 2 — 보험사명이 없으면 상품명 키워드로 유추]
    - 상품명/보장명에 위 키워드가 포함된 경우 해당 보험사로 매핑하세요.
    - 예: 상품명에 "메리츠" 포함 → 메리츠화재 / "let:drive" → 롯데손해보험

    [Step 3 — 매핑 실패 시]
    - Step 1, 2 모두 해당 없으면 반드시 "확인필요"로 반환하세요.
    - ❌ 절대 금지: "삼성생명"을 기본값·추측값으로 사용하지 마세요.
12. 납입률: 원문에 납입률 정보가 없으면 0으로 설정. 납입률은 절대 추측하지 말 것.
13. 납입기간: "20납", "20년납", "(20년납)" 등 → "20년납" 형식으로 통일. "3년", "(3년)" → "3년납" 형식으로.
14. 가입연월: "2022.12월", "2022.12" → "2022.12" 형식으로.

카테고리 분류 기준 (우선순위 순서대로 적용):
- 암진단: 암진단비, 유사암진단비, 특정암, 고액암, 소액암 관련 → 단, 양성뇌종양진단비는 반드시 📌특이사항으로 분류
- 뇌혈관: 뇌출혈진단비, 뇌졸중진단비, 뇌혈관질환진단비, 뇌혈관질환수술비 관련
- 심장: 급성심근경색진단비, 허혈성심장질환진단비, 심장질환진단비, 심장질환수술비 관련
- 간병: 간병인사용일당, 치매진단 관련
- 수술비: 종수술(1~5종), 상해수술비, 골절수술, 흉터복원수술 관련
- 실손: 급여입원의료비, 급여외래의료비, 급여처방조제료, (상해+질병)급여 관련
- 비급여: 도수치료, 체외충격파, 증식치료, 비급여주사제, MRI검사 관련
- 상해: 상해사망, 상해후유장해, 교통상해사망후유장해, 상해중환자실입원일당, 교통상해입원일당,
         자동차사고부상보장, 교통상해50%이상후유장해 관련
         → 단, 자동차사고부상보장/교통상해 관련은 반드시 상해로 분류
- 사고처리: 교통사고처리지원금 관련 (6주미만 포함)
- 벌금: 교통사고벌금(대인/대물), 업무상과실·중과실벌금, 과실치사상벌금 관련
- 특이사항: 위에 해당 안 되는 항목 (자동차사고변호사선임비용, 강력범죄피해보장, 보복운전피해보장, 양성뇌종양진단비, 가족생활배상책임, 골절진단비, 화상진단비, 깁스치료비, 성형수술비, 배상책임 등)

반환 형식:
{
  "name": "고객명 (없으면 null)",
  "rrn": "주민등록번호 XXXXXX-XXXXXXX 형식 (없으면 null)",
  "age": 만나이 숫자 (없으면 null),
  "gender": "남 또는 여 (없으면 null)",
  "phone": "010-XXXX-XXXX 형식 (없으면 null)",
  "address": "주소 전체 (없으면 null)",
  "job": "직업 (없으면 null)",
  "workplace": "직장/소속명 (없으면 null)",
  "bank_name": "은행명만 (없으면 null)",
  "bank_account": "계좌번호 숫자+하이픈만 (없으면 null)",
  "driver_license": "운전면허번호 (없으면 null)",
  "contracts": [
    {
      "company": "보험사 풀네임 (텍스트 직접 확인 → 없으면 상품명 키워드 매핑 → 모두 실패 시 '확인필요'. 삼성생명 기본값 절대 금지)",
      "product_name": "상품명",
      "insurance_type": "건강/실손/운전자/자동차/암/치아/간병/CI/종신 중 하나",
      "monthly_fee": 월보험료숫자 (없으면 0),
      "payment_status": "유지/완납/실효 중 하나 (기본값: 유지)",
      "payment_rate": 납입률숫자 (원문에 없으면 반드시 0),
      "contract_start": "YYYY.MM 형식 (없으면 null)",
      "payment_years": "20년납 형식 (없으면 null)",
      "expiry_age": "90세 형식 (없으면 null)",
      "coverages": [
        {
          "category": "위 카테고리 중 하나",
          "name": "보장명",
          "amount": 금액숫자(원단위)
        }
      ]
    }
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    })

    const data = await response.json()
    console.log('Claude API response:', JSON.stringify(data).slice(0, 500))
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Claude API 오류' })
    }
    const raw = data.content?.[0]?.text || '{}'
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    res.status(200).json(parsed)
  } catch (e: any) {
    console.error('Parse error:', e.message)
    res.status(500).json({ error: e.message || '파싱 중 오류가 발생했어요!' })
  }
}
