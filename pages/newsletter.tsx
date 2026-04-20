import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import styles from '../styles/Newsletter.module.css'

const NEWSLETTERS = [
  {
    id: 'w2026-15',
    week: '2026년 4월 2주차',
    date: '2026.04.14',
    title: '이번 주 꼭 알아야 할 보험 뉴스',
    subtitle: '설계사님을 위한 DPA 주간 보험 브리핑',
    items: [
      {
        tag: '신상품',
        tagColor: '#1D9E75',
        tagBg: '#E6F7F1',
        title: '5세대 실손보험, 4월 말~5월 초 출시 임박',
        summary: '금융당국 인가 일정에 따라 5세대 실손보험이 4월 말~5월 초 출시될 전망입니다. 비급여를 중증과 비중증으로 구분해 차등 보장하며, 4세대 대비 보험료가 30~50% 저렴해질 것으로 예상됩니다. 단, 도수치료 등 비중증 비급여 보장은 대폭 축소됩니다.',
        tip: '1·2세대 실손 보유 고객에게 전환 안내 상담 기회입니다. 단 비급여 이용 빈도가 높은 고객은 신중하게 검토하세요!',
      },
      {
        tag: '정책변화',
        tagColor: '#B45309',
        tagBg: '#FEF3E2',
        title: 'GA 설계사 1200%룰 확대, 7월 시행 앞두고 갈등 격화',
        summary: '7월 본격 도입될 GA 설계사 1200%룰을 앞두고 일부 대형 GA에서 해촉 설계사에게 과거 성과보상금 환수를 요구하는 사례가 늘어 법적 분쟁 우려가 커지고 있습니다. 업계에서는 보상 체계 표준화와 사전 공시 강화가 시급하다고 지적합니다.',
        tip: '7월 이후 수수료 구조가 달라집니다. 장기 유지율 관리가 곧 수익으로 연결되는 구조 변화에 미리 대비하세요!',
      },
      {
        tag: '주의사항',
        tagColor: '#B91C1C',
        tagBg: '#FCEBEB',
        title: 'AI 위조 진단서 보험 심사 통과 뻔한 사건 발생',
        summary: 'AI로 만든 가짜 진단서와 입퇴원 확인서가 보험사 심사를 통과할 뻔한 사건이 발생했습니다. 날짜 실수라는 허점으로 적발됐지만, AI 기반 보험사기가 더욱 정교해지고 있어 업계가 긴장하고 있습니다.',
        tip: '고객이 보험금 청구 관련 이상한 제안을 받으면 즉시 보험사에 신고하도록 안내해주세요. 설계사도 공범으로 연루될 수 있습니다!',
      },
    ],
  },
  {
    id: 'w2026-14',
    week: '2026년 4월 1주차',
    date: '2026.04.07',
    title: '이번 주 꼭 알아야 할 보험 뉴스',
    subtitle: '설계사님을 위한 DPA 주간 보험 브리핑',
    items: [
      {
        tag: '정책변화',
        tagColor: '#B45309',
        tagBg: '#FEF3E2',
        title: '2025년 보험사기 적발액 1조 1,571억원…조직적 사기 급증',
        summary: '금감원이 발표한 2025년 보험사기 적발 현황에 따르면 적발 금액이 1조 1,571억원으로 전년 대비 증가했습니다. 자동차보험(49.5%)과 장기보험(39.8%)이 주를 이루며, 병원·보험업 종사자 주도의 조직적 사기가 급증하고 있습니다.',
        tip: '고객에게 무료 치료 제안이나 보험금 대리 청구 권유를 받으면 즉시 거절하고 보고하도록 안내하세요!',
      },
      {
        tag: '신상품',
        tagColor: '#1D9E75',
        tagBg: '#E6F7F1',
        title: '5세대 실손 출시 앞두고 경증수술비·수술비 연계 상품 부상',
        summary: '5세대 실손보험의 비중증 비급여 보장 축소가 예고되면서 정액형 경증수술비 수요가 급증하고 있습니다. DB손보의 수술비 연계 PASS 상품 등 틈새 보장 상품이 주목받고 있습니다.',
        tip: '5세대 실손 전환 상담 시 비급여 보장 공백을 정액형 수술비로 채우는 패키지 제안을 준비해보세요!',
      },
      {
        tag: '주의사항',
        tagColor: '#B91C1C',
        tagBg: '#FCEBEB',
        title: '4세대 실손 보험료 20% 인상…1·2세대는 3~5%대',
        summary: '2026년 실손보험 평균 보험료가 7.8% 인상됩니다. 특히 4세대는 20%대로 가장 큰 폭 인상되는 반면, 1세대는 3%대, 2세대는 5%대 수준입니다. 갱신 주기에 따라 적용 시점은 다릅니다.',
        tip: '갱신 예정 고객 리스트를 미리 확인하고 보험료 인상 전 안내 연락을 먼저 하세요. 고객 신뢰를 높이는 좋은 기회입니다!',
      },
    ],
  },
]

// 세로바 + 텍스트 공통 컴포넌트
function SectionTitle({ children, fontSize = 16, color = '#1a1a1a' }: { children: React.ReactNode; fontSize?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 3, height: fontSize + 2, background: '#1D9E75', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ fontSize, fontWeight: 700, color, lineHeight: 1.4 }}>{children}</span>
    </div>
  )
}

export default function Newsletter() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedId) {
      window.history.pushState({ newsletterId: selectedId }, '')
    }
  }, [selectedId])

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const selectedNewsletter = NEWSLETTERS.find(n => n.id === selectedId)

  if (selectedNewsletter) {
    return (
      <div className={styles.wrap}>
        {/* 상세 헤더 */}
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => setSelectedId(null)}>← 목록</button>
          <span className={styles.detailWeek}>{selectedNewsletter.week}</span>
        </div>

        {/* 뉴스레터 헤더 */}
        <div className={styles.newsletterHeader}>
          <p className={styles.nlWeekLabel}>{selectedNewsletter.week}</p>
          <div style={{ marginBottom: 8 }}>
            <SectionTitle fontSize={18} color="#1a1a1a">{selectedNewsletter.title}</SectionTitle>
          </div>
          <p className={styles.nlSubtitle}>{selectedNewsletter.subtitle}</p>
        </div>

        <div className={styles.nlIntro}>
          <p>안녕하세요 설계사님 👋</p>
          <p>이번 주 보험업계 핵심 뉴스 {selectedNewsletter.items.length}가지를 정리했어요. 고객 상담에 바로 활용하세요!</p>
        </div>

        {/* 뉴스 카드 */}
        {selectedNewsletter.items.map((item, i) => (
          <div key={i} className={styles.nlCard}>
            <span className={styles.nlTag} style={{ color: item.tagColor, background: item.tagBg }}>
              {item.tag}
            </span>
            <div style={{ marginBottom: 10 }}>
              <SectionTitle fontSize={15} color="#111827">{item.title}</SectionTitle>
            </div>
            <p className={styles.nlCardSummary}>{item.summary}</p>
            <div className={styles.nlTip}>
              <span className={styles.nlTipIcon}>💡</span>
              <span>설계사 활용 팁: {item.tip}</span>
            </div>
          </div>
        ))}

        {/* 푸터 */}
        <div className={styles.nlFooter}>
          <p>DPA 보험 브리핑 · 매주 월요일 발송</p>
          <p>본 뉴스레터는 DPA가 설계사님을 위해 자동으로 수집·요약한 내용입니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.listHeader}>
        <div style={{ marginBottom: 6 }}>
          <SectionTitle fontSize={16} color="#1a1a1a">📰 보험 브리핑</SectionTitle>
        </div>
        <p className={styles.listSubtitle}>매주 월요일 업데이트</p>
      </div>

      {/* 뉴스레터 목록 */}
      {NEWSLETTERS.map((nl) => (
        <div key={nl.id} className={styles.listCard} onClick={() => setSelectedId(nl.id)}>
          <div className={styles.listCardLeft}>
            <span className={styles.listWeek}>{nl.week}</span>
            <div style={{ marginBottom: 8 }}>
              <SectionTitle fontSize={14} color="#111827">{nl.title}</SectionTitle>
            </div>
            <div className={styles.listTags}>
              {nl.items.map((item, i) => (
                <span key={i} className={styles.listTag} style={{ color: item.tagColor, background: item.tagBg }}>
                  {item.tag}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.listCardRight}>
            <span className={styles.listDate}>{nl.date}</span>
            <span className={styles.listArrow}>›</span>
          </div>
        </div>
      ))}

      {/* 안내 */}
      <div className={styles.listNotice}>
        <span>🤖</span>
        <span>매주 월요일 AI가 보험업계 뉴스를 자동으로 수집·정리합니다</span>
      </div>
    </div>
  )
}
