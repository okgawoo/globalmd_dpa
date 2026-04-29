# iPlanner 시스템 구조

<!--
  📁 이 파일의 성격: SYSTEM.md
  ✅ 여기에 넣을 것:
     - DB 테이블 구조 / 컬럼 정의
     - API 엔드포인트 목록 및 흐름 (어떤 API가 뭘 하는지)
     - 외부 서비스 연동 방식 (Meritz, Solapi, Supabase 등)
     - 환경변수 목록
     - 크롤링 URL / srtSq 매핑 등 기술 구조
     - GitHub Actions / 크론 스케줄

  ❌ 여기에 넣지 말 것:
     - AI 프롬프트 구조나 분석 결과 필드 의미
     - 파싱 시 주의사항 / 실전 노하우
     - 비즈니스 판단 기준 (어떤 보험사가 좋은지 등)
     → 위 항목은 knowledge.md에
-->

> 내부 코드명: DPA | 정식명: 아이플래너(iPlanner)  
> 스택: Next.js + Supabase (tmticcyqbaotrvmoqftv) + Claude API  
> 라이브: https://globalmd-dpa.vercel.app

---

## DB 테이블 구조

```
── 고객/계약 ──────────────────────────────────────────────────────
dpa_agents (3행)
  role: 'admin' | 'agent' | 'demo'
  plan_type, demo_expires_at, slug, profile_image_url, settings(JSON)
  └─ dpa_customers (38행)
       customer_type: 'existing'(마이고객) | 'prospect'(관심고객)
       gender: '남'|'여'  birth_date, age, job, phone, email
       └─ dpa_contracts (178행)
            payment_status: '유지'|'실효'|'해지'  insurance_type
            monthly_fee, payment_years, expiry_age, contract_start
            └─ dpa_coverages (2558행)
                 category, coverage_name, amount
                 brain_coverage_type, heart_coverage_type

── 상담/일정 ──────────────────────────────────────────────────────
dpa_meetings (37행)          상담 일정 캘린더
  agent_id, customer_id, meeting_date, meeting_time
  status, pipeline_stage, type, cancel_count

dpa_consultations (10행)     상담 기록 (meetings와 연관)
  meeting_date, meeting_type, notes, status

── SMS ────────────────────────────────────────────────────────────
dpa_messages (14행)          SMS 발송 이력 (Solapi 연동)
  message_type, tone, sent_script, status
  solapi_group_id, solapi_message_id, campaign_id

dpa_sms_auth (1행)           SMS 발신번호 인증 서류
  sender_phone, signature_data, doc_url_*, status

dpa_sms_campaigns (0행)      SMS 캠페인 설정
  filter_age_min/max, filter_gender, filter_customer_type

── AI 지원 채팅 ────────────────────────────────────────────────────
dpa_support_chats (45행)     AI 고객지원 채팅 이력
  agent_id, role, content, is_escalated

── 보험공시 ────────────────────────────────────────────────────────
dpa_insurance_companies (39행)   보험사 마스터 (손해 13개 + 생명 26개)
  name, category(손해보험|생명보험), aliases(JSON), is_active

dpa_insurance_categories (21행)  보험 카테고리 마스터
  source(life|damage), category, site_url, sort_order, is_priority

dpa_insurance_sources (23행)     공시 파일 업로드 이력
  source(life|damage), category, file_name, row_count, status: active|superseded

dpa_insurance_products (7147행)  공시 파싱 결과 (보장 데이터)
  source_id, company, product_name, coverage_name
  payment_reason, payment_amount, premium_male, premium_female

dpa_insurance_validations (400행) 파싱 경고 로그
  check_type: missing_premium, severity: warning|error

meritz_pdf_files (0행)           메리츠 공시실 PDF 수집 이력
  category_name, srt_sq, product_name, storage_path, status

── YouTube 지식 엔진 ───────────────────────────────────────────────
youtube_channels (1행)       등록 채널 (is_active)
youtube_videos (5714행)      채널별 영상 (status: pending|analyzing|done|error)
youtube_analyses (10행)      Claude 분석 결과
  summary, key_points[], pitch_points[], scripts[], comparison_criteria[]

── 웹푸시 알림 ─────────────────────────────────────────────────────
push_subscriptions (19행)    웹푸시 구독 정보 (endpoint, p256dh, auth)
push_notifications (9행)     발송 이력
push_notification_reads (12행) 읽음 이력
```

---

## 주요 페이지

| 경로 | 역할 |
|------|------|
| `/customers` | 고객 목록 + 계약/보장 재입력 (AI 파싱) |
| `/report` | 고객 리포트 생성 (A4 인쇄용) |
| `/schedule` | 상담 일정 캘린더 |
| `/sales` | 영업 성과 대시보드 |
| `/admin` | 관리자 전용 (공지/설계사/YouTube/보험공시/푸시) |

---

## 핵심 API 목록

### YouTube 지식 엔진

| API | 역할 |
|-----|------|
| `POST /api/youtube-fetch-all` | YouTube Data API로 채널 전체 영상 수집 (pageToken 반복, 50개씩) |
| `POST /api/youtube-sync` | RSS로 최신 15개만 빠르게 동기화 |
| `POST /api/youtube-analyze` | 단일 영상 자막 추출 → Claude 분석 → youtube_analyses 저장 |
| `POST /api/youtube-batch-analyze` | pending 영상 3개씩 순차 분석, done이 될 때까지 반복 호출 |

**YouTube 분석 흐름:**
```
채널 등록 → youtube-fetch-all (전체 수집, YOUTUBE_API_KEY 필요)
         → youtube-batch-analyze 반복 호출
         → youtube-analyze (개별 영상)
              └─ YoutubeTranscript 자막 추출 (한국어 우선)
              └─ Claude Opus 분석
              └─ youtube_analyses 저장
```

**채널 ID 추출 (두 가지 경우):**
```
1) URL이 /channel/UC... 형태 → 정규식으로 바로 추출
2) @핸들 형태 → YouTube API 조회:
   GET https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={handle}&key={키}
```

**youtube-fetch-all — YouTube Data API:**
```
UC채널ID → UU재생목록ID (UC→UU 치환)
GET https://www.googleapis.com/youtube/v3/playlistItems
  ?part=snippet&playlistId={UU...}&maxResults=50&key={키}&pageToken={토큰}
→ nextPageToken 있으면 반복 (전체 영상 수집)
→ 완료 후 구독자 수 업데이트: /youtube/v3/channels?part=statistics
```

**youtube-sync — RSS (API 키 불필요, 최신 15개):**
```
GET https://www.youtube.com/feeds/videos.xml?channel_id={UC채널ID}
→ 정규식으로 <yt:videoId>, <title>, <published> 추출
→ 신규 감지 시 youtube-analyze 자동 트리거 (fire & forget)
```

**자막 추출 — npm: youtube-transcript:**
```typescript
YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' })  // 한국어 우선
// 실패 시 fallback → fetchTranscript(videoId)              // 기본 언어
// 8,000자까지만 Claude에 전달
```

**GitHub Actions 크론:**
- `youtube-sync.yml`: 매주 월요일 09:00 KST (UTC 00:00), `workflow_dispatch`로 수동 실행 가능
- `insurance-sync.yml`: 동일 스케줄, 메리츠화재 전체 카테고리, `--max-time 300`
- 인증: `x-cron-secret` 헤더 / GitHub Secrets: `CRON_SECRET`, `APP_URL`

**youtube_analyses 필드:**
- `summary` — 영상 핵심 2~3문장
- `key_points[]` — 핵심 포인트 3개
- `pitch_points[]` — 설계사가 고객에게 쓸 수 있는 피칭 포인트
- `scripts[]` — 실제 화법 예시 문장
- `comparison_criteria[]` — 상품 비교 기준 (예: 남자→메리츠, 여자→DB손보)

---

### 고객 리포트 생성

| API | 역할 |
|-----|------|
| `POST /api/generate-report` | 고객+계약+보장+YouTube 인사이트 수집 → Claude 분석 → 리포트 데이터 반환 |

**리포트 생성 흐름:**
```
고객 선택 → /api/generate-report
  → dpa_contracts + dpa_coverages 조회 (유지 계약만)
  → youtube_analyses에서 pitch_points/scripts/comparison_criteria/key_points 수집
  → CATEGORY_BENCHMARKS로 보장 공백(gaps) 분석
  → Claude에 고객 데이터 + YouTube 인사이트 주입 → AI 코멘트 생성
  → A4 리포트 모달 렌더링 (Recharts 차트 포함)
```

**보장 카테고리 벤치마크 기준:**
- 암진단: 권장 5,000만 / 최소 3,000만
- 뇌혈관/심장: 권장 3,000만 / 최소 2,000만
- 수술비: 권장 300만 / 최소 150만
- 실손/비급여: 유무로만 판단
- 상해: 권장 1억 / 최소 5,000만

---

### 보험공시 파이프라인

| API | 역할 |
|-----|------|
| `POST /api/insurance-upload` | 공시 파일(xls/xlsx) 업로드 → 파싱 → DB 저장 |
| `POST /api/insurance-crawl` | 메리츠 공시실 자동 크롤링 → PDF 다운로드 → Storage 저장 |

**보험공시 업로드 흐름:**
```
파일 업로드 (손해보험 xls / 생명보험 HTML-위장 xls)
  → 파일 형식 자동 판별
      - magic bytes d0cf11e0 → 진짜 XLS (손해보험 원본)
      - magic bytes 504b → xlsx (구글 드라이브 변환본)
      - 그 외 → HTML 위장 XLS (생명보험)
  → 카테고리 자동 판별 (키워드 스코어링)
  → 생명보험: parseLifeFile (HTML→tr/td 파싱)
    손해보험: parseDamageFile (SheetJS, 7행부터 데이터)
  → 기존 active 데이터 superseded 처리
  → dpa_insurance_products 배치 삽입 (500개씩)
  → 원본 파일 Supabase Storage 보관 (insurance-files 버킷)
```

**메리츠 크롤링 흐름:**
```
/api/insurance-crawl (POST)
  → meritzfire.com 공시실 접속 → 세션 쿠키 자동 발급
  → 카테고리별 상품 목록 조회 (json.smart API, 2단계)
      1단계: retrievePdList (srtSq 전달) → cmCommCd 추출
      2단계: retrieveSalPdList (cmPdDivCd 전달) → file3#[E] 암호화 경로 추출
  → PDF 다운로드 → Supabase Storage (meritz/{category}/{날짜}/)
  → meritz_pdf_files 저장 (중복 스킵)
```
**메리츠 카테고리 srtSq 매핑 (공시실 상품목록 순서 = srtSq 순서):**
```
srtSq 1  → 자동차보험
srtSq 2  → 운전자보험
srtSq 3  → 통합보험 (실손)
srtSq 4  → 질병보험 (뇌/심혈관)
srtSq 5  → 어린이보험
srtSq 6  → 암보험
srtSq 7  → 상해보험
srtSq 8  → 연금저축보험
srtSq 9  → 자축보험 (축산 계열, 미사용)
srtSq 10 → 화재/재물/비용보험
srtSq 11 → 생활보험 (간병/치매 + 반려동물보험 포함)
srtSq 12 → 장기 방카슈랑스 (미사용)
srtSq 13 → 일반 방카슈랑스 (미사용)
srtSq 14 → 배상책임보험
```
연동 완료: 1~8, 10, 11, 14 (11개) | 미지원: 치아·사망·태아보험 (메리츠 미취급)

**srtSq 탐색 방법:**
DevTools로 카테고리마다 클릭하지 않아도 됨.
공시실 상품목록 페이지의 카테고리 순서 = srtSq 번호 순서.
카테고리 1개에서 json.smart 요청의 srtSq 값 확인 후 → 1~14 순서대로 대입하면 전체 매핑 완성.
pdDtlList가 비어있으면 빈 카테고리 또는 미존재.

---

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
YOUTUBE_API_KEY          ← youtube-fetch-all에 필요 (없으면 RSS fallback 불가)
CRON_SECRET              ← insurance-crawl 크론 인증
NEXT_PUBLIC_APP_URL      ← youtube-batch-analyze 내부 fetch용
```

---

## Claude API 사용 현황

| API | 모델 | 용도 |
|-----|------|------|
| `youtube-analyze` | claude-opus-4-5 | 영상 자막 분석 (pitch_points, scripts 등 추출) |
| `generate-report` | claude-sonnet-4-6 | 고객 리포트 AI 코멘트 생성 |
| `customers` (재입력) | claude-opus-4-5 | 보험 이미지/텍스트 파싱 |
