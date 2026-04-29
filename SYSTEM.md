# iPlanner 시스템 구조

> 내부 코드명: DPA | 정식명: 아이플래너(iPlanner)  
> 스택: Next.js + Supabase (tmticcyqbaotrvmoqftv) + Claude API  
> 라이브: https://globalmd-dpa.vercel.app

---

## DB 테이블 구조

```
dpa_agents
  └─ dpa_customers (agent_id)
       └─ dpa_contracts (customer_id)
            └─ dpa_coverages (contract_id)

dpa_insurance_companies       보험사 마스터 (손해 13개 + 생명 26개)
dpa_insurance_sources         공시 파일 업로드 이력
dpa_insurance_products        공시 파싱 결과 (보장 데이터)
dpa_insurance_validations     파싱 경고 로그

youtube_channels              설계사 유튜브 채널 목록
youtube_videos                채널별 영상 목록 (status: pending/analyzing/done/error)
youtube_analyses              영상 분석 결과 (Claude 추출)

push_subscriptions            웹푸시 구독 정보
push_notifications            발송 이력
push_notification_reads       읽음 이력

meritz_pdf_files              메리츠 공시실 PDF 수집 이력
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
      1단계: retrievePdList → cmCommCd 추출
      2단계: retrieveSalPdList → file3#[E] 암호화 경로 추출
  → PDF 다운로드 → Supabase Storage (meritz/{category}/{날짜}/)
  → meritz_pdf_files 저장 (중복 스킵)
```

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
