# DPA Admin — 타이포그래피 기준

> 웹 전용 기준. 모바일(`@media (max-width: 900px)`) 블록은 별도 검토.

---

## 폰트 크기 체계

| 구분 | 크기 | 굵기 | Tailwind | 적용 위치 |
|---|---|---|---|---|
| 페이지 제목 | 20px | 700 | `text-xl font-bold` | 각 페이지 H1 (`대시보드`, `고객 관리` 등) |
| 섹션 카드 제목 | 14px | 600 | `text-sm font-semibold` | SectionCard 헤더 타이틀 |
| 통계 카드 값 | 24px | 700 | `text-2xl font-bold` | StatCard 숫자 값 |
| 통계 카드 라벨 | 13px | 500 | `text-[13px] font-medium` | StatCard 제목·서브 텍스트 |
| 본문 데이터 | 14px | 400 | `text-sm` | 테이블 셀 값, 이름, 상담 내용, 계약 정보 |
| 메타 정보 | 14px | 400 | `text-sm` | 날짜, 성별, 계약 건수, 시간, 장소 |
| 서브 타이틀 | 13px | 400 | `text-[13px]` | 페이지 인사말, 섹션 카드 sub, 빈 상태 안내 |
| UI 라벨 | 13px | 500 | `text-[13px] font-medium` | 폼 필드명 (`고객 선택`, `날짜` 등) |
| 테이블 헤더 | 12px | 600 | `text-xs font-semibold uppercase` | 테이블 컬럼명 |
| 배지·칩 | 12px | 500 | `text-xs font-medium` | 상태 배지, 고객 유형 칩, 캘린더 요일 |
| 보조 수치 | 12px | 400 | `text-xs` | 섹션 카드 총계 표시 (`총 16명`) |

---

## 적용 원칙

- **에이전트가 직접 읽는 데이터** (이름, 계약 정보, 메모, 날짜) → 최소 **14px**
- **UI 구조 라벨** (테이블 헤더, 배지, 칩, 총계) → **12px**
- **보조 설명** (서브타이틀, 폼 라벨, 안내 문구) → **13px**
- **9~11px 사용 금지** — 중년 여성 사용자 가독성 기준 (11px 이하 전면 금지)
- **섹션 카드 제목은 `text-sm font-semibold`** 고정 — 별도 크기 지정 금지

---

## 색상 토큰 매핑

| 용도 | 토큰 | 적용 위치 |
|---|---|---|
| 주요 텍스트 | `--text-primary` | 이름, 수치, 카드 제목, 날짜 |
| 보조 텍스트 | `--text-secondary` | 성별, 계약 건수, 메모, 서브 설명 |
| 약한 텍스트 | `--text-tertiary` | 테이블 헤더, 배지, 총계, 빈 상태 |
| 강조색 | `--accent` | 활성 메뉴, 배지 강조, 차트 현재 월 |
| 강조 배경 | `--accent-bg` | 활성 메뉴 배경, 아이콘 배경 |
| 카드 배경 | `--bg-panel` | SectionCard, StatCard 배경 |
| 앱 배경 | `--bg-app` | 페이지 전체 배경, 타일 배경 |
| hover 배경 | `--bg-elevated` | 행 hover, 버튼 hover |
| 기본 테두리 | `--border-default` | 카드 테두리, 구분선 |
| hover 테두리 | `--border-hover` | 메뉴 hover 테두리 |

---

## 헤더 (AdminLayout) 기준

| 요소 | 스타일 |
|---|---|
| 브랜드 텍스트 "insurance planner" | 13px / 500 / italic / `--text-secondary` |
| PRO 배지 | 11px / 700 / `--accent` 색 + 테두리 pill |
| SMS 사용량 | 12px / `--text-secondary` + 수치는 `--text-primary` 600 |
| 날짜 | `text-sm` / `--text-primary` — 페이지 제목 우측 끝 배치 |
| 아이콘 버튼 | `--text-primary` |

---

## 페이지별 H1 위치 기준

- **페이지 제목 + 서브타이틀** → `flex items-end justify-between`
- **날짜** → 우측 끝, 서브타이틀과 같은 라인 (`items-end`)
- 예시:
  ```tsx
  <div className="mb-6 flex items-end justify-between">
    <div>
      <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>페이지명</h1>
      <p className="mt-0.5 text-[13px]" style={{ color: 'hsl(var(--text-secondary))' }}>서브타이틀</p>
    </div>
    <span className="text-sm" style={{ color: 'hsl(var(--text-primary))' }}>날짜</span>
  </div>
  ```

---

## 적용 현황

| 파일 | 상태 |
|---|---|
| `components/AdminDashboard.tsx` | ✅ 적용 완료 |
| `components/AdminLayout.tsx` | ✅ 적용 완료 |
| `styles/Consultations.module.css` | ✅ 적용 완료 |
| `styles/Customers.module.css` | ⏳ 미적용 |
| `styles/Input.module.css` | ⏳ 미적용 |

---

## 수정 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-25 | 초안 작성 — Consultations 페이지 기준 수립 |
| 2026-04-25 | 메타 정보(날짜·시간·장소·상태) 13px → 14px 상향 |
| 2026-04-26 | 페이지 제목 24px → 20px 하향 (헤더 바 제거 후 시각적 균형 기준) |
| 2026-04-26 | 대시보드 작업 기준 전면 반영 — 테이블 헤더 12px, 본문 데이터 14px, 배지 12px 통일 |
