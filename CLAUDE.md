# iPlanner (DPA) Claude Code 작업 지침

## 프로젝트 기본 정보
- 정식명: 아이플래너(iPlanner) / 내부 코드명: DPA
- GitHub: okgawoo/globalmd_dpa
- 라이브 URL: https://globalmd-dpa.vercel.app
- 스택: Next.js + Supabase (tmticcyqbaotrvmoqftv) + Claude API
- Vercel project: prj_5LYFCsX7aS83knv8O4jWdpoUKeIW / team: team_O3Rm37Jn6oKQyPDuVX5Vfjip

## 말투 규칙
- 나를 "오빠"라고 부를 것
- 친근하고 편안한 말투 사용 (단, 반말 금지 — 존댓말 기반 친근체 사용)
- 이모지 적절히 사용
- 작업 전 구조/순서 먼저 설명 후 진행
- 질문은 한 번에 하나씩만

## 작업 경로 (절대 규칙)
- **메인 프로젝트 경로만 사용: `C:\Users\OKGA-HOME\Documents\GitHub\globalmd_dpa`**
- 워크트리(`.claude/worktrees/` 하위) 절대 사용 금지
- 작업 전 현재 경로가 메인 프로젝트인지 반드시 확인
- localhost:3000 dev 서버가 메인 프로젝트에서 실행되므로 워크트리 수정은 반영 안 됨

## 워크트리 작업 원칙 (반드시 준수)
1. **작업 경로 엄수**
   - 모든 코드 수정은 메인 프로젝트(`C:\Users\OKGA-HOME\Documents\GitHub\globalmd_dpa`)에서만
   - GitHub push = Vercel 베타 자동 배포이므로, push 전 오빠 확인 필수

2. **채팅방 이동 전 commit 필수**
   - 사용자가 채팅방 이동 의사를 밝히면 → 즉시 미커밋 변경사항 확인
   - 커밋되지 않은 작업이 있으면 반드시 commit 실행 후 이동 안내
   - 새 채팅방의 워크트리는 마지막 commit 기준으로 시작하므로, 미커밋 작업은 유실됨

3. **작업 전 명시적 허가 필수**
   - 사용자가 명확하게 "진행해", "해줘" 등으로 허가하기 전에는 코드 수정 금지
   - 원인 분석·설명 단계와 실행 단계를 반드시 분리할 것

4. **새 채팅방 시작 시 워크트리 동기화 필수**
   - 작업 시작 전 다른 워크트리(`.claude/worktrees/` 하위 전체)의 미커밋 변경사항 확인
   - 미커밋 파일이 있으면 날짜·내용 비교 후 최신본을 현재 워크트리에 동기화
   - 동기화 후 커밋까지 완료한 뒤 작업 시작

## 절대 원칙 (반드시 준수)
1. **모바일 코드 절대 건드리지 말 것**
   - `@media (max-width: 768px)` 블록 수정 금지
   - 모바일 전용 클래스/스타일 수정 금지
   - 웹 수정 시 모바일 레이아웃에 영향 주는 공통 속성 변경 금지

2. **기존 로직 보존**
   - DB 쿼리, API 호출, 비즈니스 로직 수정 필요 시 → 반드시 먼저 제안하고 오빠 컨펌 후 진행
   - UI/스타일 변경은 자유롭게 진행 가능
   - 파일 전체 재작성 금지 → 필요한 부분만 수정

3. **작업 전 보고**
   - 작업 시작 전 무엇을 어떻게 할지 먼저 설명
   - 여러 파일 동시 수정 시 목록 먼저 공유

## DB 규칙
- `dpa_customers.customer_type`: `existing`(마이고객), `prospect`(관심고객) → `active` 사용 금지
- `dpa_customers.gender`: `남`/`여` 직접 저장 → resident_number 파싱 금지
- 나이 필터: `birth_date` 컬럼 직접 사용
- INSERT 전 반드시 `SELECT DISTINCT`로 허용값 확인

## CSS/스타일 원칙
- CSS 변수 사용 금지, 하드코딩 색상 사용 (`#1D9E75`, `#FAF9F5`, `#EDEBE4` 등)
- 웹 수정: `@media (min-width: 769px)` 또는 공통 스타일만
- 클래스명 직접 지정, `!important` 필요 시 사용
- 수정 전 실제 파일에서 클래스명 확인 후 수정

## 레이아웃 원칙
- max-width: 900px, margin auto 중앙정렬
- 탭 상태는 sessionStorage로 유지
- 리스트 페이지에서 이력/부가 콘텐츠는 서브탭 분리

## 주요 DB 테이블
- `dpa_agents` → `dpa_customers` → `dpa_contracts` → `dpa_coverages`
- `dpa_insurance_companies` (손해보험 13개 + 생명보험 26개 마스터)
- `push_subscriptions`, `push_notifications`, `push_notification_reads`

## 커밋/배포
- 커밋 후 푸시까지 완료
- summary는 한글로 간결하게 (prefix 없이 내용만)
- 오빠가 "1" 또는 "111" → 푸시 완료 신호

## 알림 페이지 구조 잠금 (절대 변경 금지)
- `notifications_new.tsx` 기준
- phoneCol 직계 자식: 수신자/AI배지/설명/톤버튼 (width:100%)
- flex center 컨테이너 안에 phoneWrapper(260px) + phoneFrame
- actionBtns는 margin-top:auto로 최하단 고정

## Admin 전용 UI 기능
- `dpa_agents.role = 'admin'`인 계정에만 새 UI 표시
- admin 계정: `admin@dpa.com` (옥윤철)
- 구현 방식: `lib/AdminContext.tsx` + `useAdmin()` 훅 사용
- 완성 후 전체 배포 시 `isAdmin &&` 조건 제거

## Admin UI 디자인 원칙
- 스타일: Studio Admin 스타일 (모노톤 + 와이어 느낌)
- 이모지 전면 제거
- 레이아웃:
  - 기본: 2열 (사이드바 + 메인)
  - 고객/데이터 작업 시: 3열로 전환
- 컴포넌트: shadcn/ui 기반
- 참고: v0.dev 스타일
