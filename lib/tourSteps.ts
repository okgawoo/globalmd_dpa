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

  // ── 7: 대시보드
  {
    page: '/',
    title: '대시보드',
    content: '전체 고객 현황, 오늘의 할일, 영업 일정을 한눈에 확인해요. 보장 공백·만기 임박 고객도 바로 보여요.',
  },

  // ── 8: 데이터 입력
  {
    page: '/input',
    title: '데이터 입력',
    content: '보험증권 이미지나 텍스트를 붙여넣으면 AI가 고객 정보와 계약 내용을 자동으로 분석·저장해요. 가장 많이 쓰는 핵심 기능이에요.',
  },

  // ── 9: 고객 관리
  {
    page: '/customers',
    title: '고객 관리',
    content: '마이고객·관심고객을 필터·검색으로 관리해요. 고객별 보장 현황, 계약 이력, 보장 공백도 한눈에 볼 수 있어요.',
  },

  // ── 10: 고객 리포트
  {
    page: '/report',
    title: '고객 리포트',
    content: 'AI가 고객의 보장 현황을 분석해 전문적인 리포트를 자동 생성해요. 상담 자료로 바로 활용할 수 있어요.',
  },

  // ── 11: 상담 일정
  {
    page: '/consultations',
    title: '상담 일정',
    content: '고객 상담 일정을 달력으로 등록·관리해요. 상담 후 미팅 노트와 다음 액션도 기록할 수 있어요.',
  },

  // ── 12: 문자 발송
  {
    page: '/notifications',
    title: '문자 발송',
    content: '생일·만기·보장 공백 고객을 자동으로 필터링해 AI가 작성한 맞춤 문자를 한 번에 발송해요.',
  },

  // ── 13: 뉴스레터
  {
    page: '/newsletter',
    title: '뉴스레터',
    content: 'AI가 최신 보험 뉴스를 정리해 고객에게 발송할 뉴스레터를 자동 작성해요. 고객 신뢰도를 높이는 데 효과적이에요.',
  },

  // ── 14: 캠페인 발송
  {
    page: '/campaign',
    title: '캠페인 발송',
    content: '조건에 맞는 고객을 자동 매칭해 맞춤 캠페인을 발송해요. 긴급 특약 안내도 이 페이지에서 진행해요.',
  },

  // ── 15: 영업 관리
  {
    page: '/sales',
    title: '영업 관리',
    content: '미팅 기록, 영업 파이프라인을 관리하고 월별 성과를 확인해요.',
  },

  // ── 16: 완료
  {
    title: '준비 완료! 🎉',
    content: '이제 아이플래너를 마음껏 활용해보세요. 언제든 우측 상단 ❓ 버튼으로 이 투어를 다시 볼 수 있어요.',
  },
]
