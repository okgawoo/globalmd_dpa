export interface TourStep {
  page?: string             // 이 스텝 진입 시 navigate할 경로 (없으면 현재 페이지 유지)
  targetId?: string         // 하이라이트할 요소 ID (없으면 하단 중앙 설명 카드)
  title: string
  content: string
  tooltipPosition?: 'right' | 'bottom' | 'left' | 'top'
}

export const tourSteps: TourStep[] = [
  // ── 0: 웰컴
  {
    title: '아이플래너에 오신 것을 환영해요! 👋',
    content: '보험 설계사를 위한 AI 자동화 플랫폼이에요. 지금부터 주요 기능을 하나씩 직접 보여드릴게요.',
  },

  // ── 1: 사이드바 접기 버튼
  {
    page: '/',
    targetId: 'tour-sidebar-toggle',
    title: '사이드바 접기 / 펼치기',
    content: '이 버튼으로 사이드바를 접어 작업 공간을 더 넓게 쓸 수 있어요. 접힌 상태에서도 아이콘에 마우스를 올리면 메뉴 이름이 나와요.',
    tooltipPosition: 'right',
  },

  // ── 2: 공지 팝업
  {
    page: '/',
    targetId: 'tour-announcement',
    title: '공지사항 배너',
    content: '새로운 기능 업데이트나 중요 공지를 여기서 확인할 수 있어요. 클릭하면 자세한 내용으로 이동해요.',
    tooltipPosition: 'bottom',
  },

  // ── 3: 헤더 — 투어 버튼
  {
    page: '/',
    targetId: 'tour-btn-help',
    title: '투어 다시 보기',
    content: '이 버튼을 누르면 지금 보고 있는 이 투어를 언제든 다시 볼 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 4: 헤더 — 다크모드
  {
    targetId: 'tour-btn-theme',
    title: '라이트 / 다크 모드',
    content: '밝은 화면이 불편하다면 다크 모드로 전환해보세요. 설정은 자동으로 저장돼요.',
    tooltipPosition: 'bottom',
  },

  // ── 5: 헤더 — 알림 버튼
  {
    targetId: 'tour-btn-bell',
    title: '알림',
    content: '새로운 알림이 있으면 여기서 확인할 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 6: 헤더 — 설정 버튼
  {
    targetId: 'tour-btn-settings',
    title: '설정',
    content: '프로필, 발신번호, 알림 설정 등 계정 관련 설정을 변경할 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 7: 대시보드 전체 소개
  {
    page: '/',
    title: '대시보드',
    content: '전체 고객 현황, 오늘의 할일, 영업 일정을 한눈에 확인해요. 보장 공백·만기 임박 고객도 바로 보여요.',
  },

  // ── 8: 데이터 입력 — 페이지 소개
  {
    page: '/input',
    title: '데이터 입력',
    content: '보험증권 내용을 붙여넣으면 AI가 고객 정보와 계약 내용을 자동 분석해요. 아이플래너의 가장 핵심 기능이에요!',
  },

  // ── 9: 데이터 입력 — 탭 종류
  {
    page: '/input',
    targetId: 'tour-input-tabs',
    title: '입력 방식 선택',
    content: '텍스트 붙여넣기 · 파일 업로드 · 명함 입력 · 수동 입력 — 4가지 방법으로 고객 정보를 등록할 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 10: 데이터 입력 — 붙여넣기 영역
  {
    page: '/input',
    targetId: 'tour-input-paste',
    title: '보장 내역 붙여넣기',
    content: '고객 보험증권의 보장 내역을 여기에 붙여넣으세요. 정액형과 실손형을 나누어 입력할 수 있어요.',
    tooltipPosition: 'right',
  },

  // ── 11: 데이터 입력 — AI 분석 버튼
  {
    page: '/input',
    targetId: 'tour-input-parse-btn',
    title: 'AI로 분석하기',
    content: '이 버튼을 누르면 AI가 보장 내역을 자동 분석해 보험사·상품명·보장 항목을 정리해줘요. 보통 5~10초 정도 걸려요.',
    tooltipPosition: 'top',
  },

  // ── 12: 고객 관리 — 페이지 소개
  {
    page: '/customers',
    title: '고객 관리',
    content: '마이고객·관심고객을 필터·검색으로 관리해요. 고객별 보장 현황, 계약 이력, 보장 공백도 한눈에 볼 수 있어요.',
  },

  // ── 13: 고객 관리 — 탭
  {
    page: '/customers',
    targetId: 'tour-customers-tabs',
    title: '마이고객 / 관심고객',
    content: '마이고객은 실제 계약 고객, 관심고객은 잠재 고객이에요. 탭으로 쉽게 구분해서 관리할 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 14: 고객 관리 — 필터 행
  {
    page: '/customers',
    targetId: 'tour-customers-filter',
    title: '고객 필터 & 정렬',
    content: '연령대별 필터, 정렬 기준(완납임박·보장공백·생일순 등), 이름 검색으로 원하는 고객을 빠르게 찾을 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 15: 고객 리포트 — 페이지 소개
  {
    page: '/report',
    title: '고객 리포트',
    content: 'AI가 고객의 보장 현황을 분석해 전문적인 리포트를 자동 생성해요. 상담 자료로 바로 활용할 수 있어요.',
  },

  // ── 16: 고객 리포트 — 고객 선택
  {
    page: '/report',
    targetId: 'tour-report-customer-select',
    title: '고객 선택',
    content: '리포트를 만들 고객을 먼저 검색해서 선택하세요. 선택하면 해당 고객의 보장 데이터가 불러와져요.',
    tooltipPosition: 'left',
  },

  // ── 17: 고객 리포트 — AI 분석 버튼
  {
    page: '/report',
    targetId: 'tour-report-generate-btn',
    title: 'AI 분석 생성',
    content: '고객을 선택하고 이 버튼을 누르면 AI가 보장 공백·중복·강화 포인트를 자동으로 분석해 리포트를 만들어줘요.',
    tooltipPosition: 'left',
  },

  // ── 18: 상담 일정 — 캘린더
  {
    page: '/consultations',
    targetId: 'tour-cal-card',
    title: '상담 캘린더',
    content: '날짜를 클릭하면 상담 일정을 바로 등록할 수 있어요. 방문·전화·화상·기타 유형으로 색상을 구분해서 표시해요.',
    tooltipPosition: 'right',
  },

  // ── 19: 상담 일정 — 오늘/이번 주 패널
  {
    page: '/consultations',
    targetId: 'tour-cal-schedule',
    title: '오늘 & 이번 주 일정',
    content: '오늘과 이번 주에 잡힌 상담 일정을 한눈에 확인해요. 일정을 클릭하면 상세 내용 확인·수정도 바로 할 수 있어요.',
    tooltipPosition: 'left',
  },

  // ── 20: 문자 발송 — 이슈 카드
  {
    page: '/notifications',
    targetId: 'tour-notif-issue-list',
    title: '문자 발송 대상 고객',
    content: '완납 임박·보장 공백·생일·만기 임박 등 상황별로 고객을 자동 분류해요. 카드를 클릭하면 해당 고객 목록이 열려요.',
    tooltipPosition: 'right',
  },

  // ── 21: 문자 발송 — 폰 미리보기
  {
    page: '/notifications',
    targetId: 'tour-notif-phone-col',
    title: 'AI 문자 미리보기',
    content: 'AI가 고객 상황에 맞는 문자를 자동 작성해요. 폰 화면으로 미리보기하고 수정 후 바로 발송할 수 있어요.',
    tooltipPosition: 'left',
  },

  // ── 22: 뉴스레터 — 주차 목록
  {
    page: '/newsletter',
    targetId: 'tour-newsletter-weeks',
    title: '주간 뉴스레터 목록',
    content: '매주 월요일 업데이트되는 보험 뉴스를 확인하세요. 주차별 발행 목록에서 원하는 주를 선택할 수 있어요.',
    tooltipPosition: 'right',
  },

  // ── 23: 뉴스레터 — 아티클 내용
  {
    page: '/newsletter',
    targetId: 'tour-newsletter-content',
    title: '이번 주 보험 뉴스',
    content: '아이템을 클릭하면 설계사 활용 팁도 펼쳐봐요. 고객 상담 시 트렌드 정보로 활용할 수 있어요.',
    tooltipPosition: 'left',
  },

  // ── 24: 캠페인 발송 — 탭
  {
    page: '/campaign',
    targetId: 'tour-campaign-tabs',
    title: '캠페인 탭 구성',
    content: '새 캠페인 만들기·⚡ 긴급 특약 안내·발송 이력 3가지 탭으로 구성돼요. 긴급 특약은 시즌별 특약 정보를 빠르게 발송해요.',
    tooltipPosition: 'bottom',
  },

  // ── 25: 캠페인 발송 — 타겟 필터
  {
    page: '/campaign',
    targetId: 'tour-campaign-filter',
    title: '타겟 고객 필터',
    content: '나이·성별·고객 유형·보장 공백 여부 등 조건을 설정하면 조건에 맞는 고객이 자동으로 선별돼요.',
    tooltipPosition: 'right',
  },

  // ── 26: 영업 관리 — KPI
  {
    page: '/sales',
    targetId: 'tour-sales-kpi',
    title: '이번 달 영업 성과',
    content: '이번 달 계약 건수·월보험료·보유 고객 수·취급 보험 종류를 카드로 한눈에 확인해요.',
    tooltipPosition: 'bottom',
  },

  // ── 27: 영업 관리 — 차트
  {
    page: '/sales',
    targetId: 'tour-sales-charts',
    title: '계약 현황 & 목표 관리',
    content: '최근 6개월 계약 추이 그래프와 이번 달 목표를 설정하고 달성률을 확인할 수 있어요.',
    tooltipPosition: 'bottom',
  },

  // ── 28: 완료
  {
    title: '준비 완료! 🎉',
    content: '이제 아이플래너를 마음껏 활용해보세요. 언제든 우측 상단 ❓ 버튼으로 이 투어를 다시 볼 수 있어요.',
  },
]
