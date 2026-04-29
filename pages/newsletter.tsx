import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import s from '../styles/Newsletter.module.css'

// ─── 뉴스레터 데이터 ───────────────────────────────────────
const NEWSLETTERS = [
  {
    id: 'w2026-18',
    week: '2026년 4월 4주차',
    date: '2026.04.30',
    items: [
      {
        tag: '신상품',
        tagColor: '#1D9E75',
        tagBg: '#E6F7F1',
        title: '5세대 실손보험 5월 출시 확정 — 보험료 최대 40% 저렴, 전환 시 50% 추가 할인 검토',
        summary: '금융당국 인가가 완료되면서 5세대 실손보험이 5월 초 정식 출시됩니다. 기존 2세대 실손 대비 보험료가 최대 40% 저렴하며, 비급여 진료를 중증·비중증으로 구분해 보장을 차등 적용하는 것이 핵심 변화입니다. 금융당국은 1·2세대 실손 가입자가 5세대로 전환 시 3년간 보험료를 50% 할인해주는 방안도 함께 검토 중입니다. 단, 도수치료 등 비중증 비급여 항목의 보장은 대폭 축소됩니다.',
        tip: '5세대 출시를 계기로 기존 구형 실손 보유 고객에게 전환 상담 기회를 만드세요. 단, 비급여 이용이 잦은 고객(도수치료 등)은 전환 시 손해가 날 수 있어 신중한 안내가 필요합니다!',
        source: '뉴스1 · 전자신문 (2026.04.28)',
      },
      {
        tag: '정책변화',
        tagColor: '#B45309',
        tagBg: '#FEF3E2',
        title: 'GA 수수료 1200%룰 7월 시행 — 3개월 유예 가능성 검토 중, 설계사 대이동 조짐',
        summary: '7월 본격 시행 예정인 GA 1200%룰을 앞두고 일부 대형 GA들이 전산 준비 부족을 이유로 최대 3개월 시행 유예를 당국에 요청한 것으로 알려졌습니다. 이 규칙은 GA 소속 설계사의 초년도 수수료를 월 납입보험료의 12배(1,200%) 이내로 제한하는 것으로, 기존에 GA가 보험사 수수료 외에 추가로 얹어주던 구조가 원천 차단됩니다. 수수료 유리한 GA를 찾아 이동하는 설계사들이 늘어나며 업계 내 리쿠르팅 경쟁도 과열 조짐을 보이고 있습니다.',
        tip: '7월 이후엔 초년도 목돈 수수료가 사라지고 계약 유지율이 직접 수입과 연결됩니다. 지금 당장 기존 고객 관리에 집중하는 게 장기적으로 가장 좋은 전략입니다!',
        source: 'StraightNews · 중앙이코노미뉴스 (2026.04)',
      },
      {
        tag: '소비자보호',
        tagColor: '#185FA5',
        tagBg: '#E6F1FB',
        title: '손보협회, 금융권 최초 「소비자보호 협의체」 출범 — 자동차사고 과실비율 기준 정비 착수',
        summary: '손해보험협회가 4월 28일 금융권 최초로 소비자보호 협의체를 공식 출범시켰습니다. 첫 과제로 자동차사고 과실비율 인정기준의 일관성 문제를 다루기로 했으며, 유사한 사고 유형에서도 과실비율 산정이 들쭉날쭉하다는 소비자 불만을 반영한 것입니다. 협의체에는 법학 교수·변호사·소비자단체 등 외부 전문가가 참여해 독립성을 높였습니다. 향후 논의 결과는 보험 약관 및 표준 지침 개정에 반영될 예정입니다.',
        tip: '자동차 사고 관련 분쟁 상담 시 "과실비율 기준이 곧 정비됩니다"라는 정보를 공유하면 고객 신뢰도를 높일 수 있어요. 자동차보험 상담 시 적극 활용하세요!',
        source: '보험AI뉴스 다자비 (2026.04.28)',
      },
    ],
  },
  {
    id: 'w2026-17',
    week: '2026년 4월 3주차',
    date: '2026.04.21',
    items: [
      {
        tag: '정책변화',
        tagColor: '#B45309',
        tagBg: '#FEF3E2',
        title: 'GA 수수료 1200%룰, 7월 시행 확정 — 설계사 소득 구조 대전환',
        summary: '금융위원회가 2026년 7월부터 GA 소속 설계사에게도 1200%룰을 전면 적용하기로 확정했습니다. 기존엔 전속 설계사에게만 해당됐지만 이제 GA도 계약 초년도 수수료 총액을 월납 보험료의 12배 이내로 제한받습니다. GA업계는 시행 시점을 6개월 유예해달라고 건의했지만 받아들여지지 않았습니다. 아울러 2027년부터는 수수료 4년 분급제가 단계적으로 도입됩니다.',
        tip: '초년도 목돈 수수료 구조가 사라집니다. 고객 유지율이 곧 내 수입이 되는 구조로 바뀌는 만큼, 지금부터 기존 고객 관리에 더 공을 들이세요. 계약 유지율이 높을수록 장기유지 수수료가 쌓입니다!',
      },
      {
        tag: '통계',
        tagColor: '#185FA5',
        tagBg: '#E6F1FB',
        title: 'GA 설계사 30만명 돌파했지만 1인당 생산성은 8.5% 급감',
        summary: '2025년 기준 생명·손해보험사 전속 설계사 수는 21만6000명으로 늘었지만, 이들이 거둔 수입보험료는 오히려 8.5% 감소했습니다. 대형 GA(설계사 500명 이상)의 수입수수료는 전년 대비 21.6% 증가해 외형은 커졌지만 1인당 생산성이 뚜렷하게 뒷걸음쳤습니다. 업계에서는 양적 팽창보다 질적 성장이 시급하다는 목소리가 높아지고 있습니다.',
        tip: '경쟁이 치열해질수록 "많이 파는 설계사"보다 "잘 관리하는 설계사"가 살아남습니다. 아이플래너로 고객 보장공백·완납임박 알림을 챙겨서 차별화된 서비스를 만들어보세요!',
      },
      {
        tag: '신상품',
        tagColor: '#1D9E75',
        tagBg: '#E6F7F1',
        title: 'KB손보, 보험료 낮추고 보장 넓힌 4월 신상품 출시',
        summary: 'KB손해보험이 보험료 인하와 보장 확대를 동시에 구현한 신상품 "5·10·10 Young플러스 건강보험"을 4월에 출시했습니다. 주요 담보 보험료를 최대 2% 낮추면서 암진단·뇌혈관 등 핵심 보장을 강화한 것이 특징입니다. 젊은 고객층을 겨냥한 설계로, 납입 기간 대비 보장 효율이 높다는 평가입니다.',
        tip: '30~40대 관심고객에게 "젊을 때 가입하면 이득"이라는 포인트로 접근해보세요. 보험료 부담 줄이면서 보장 넓히는 상품은 첫 설계 상담에 딱 좋은 소재입니다!',
      },
    ],
  },
  {
    id: 'w2026-15',
    week: '2026년 4월 2주차',
    date: '2026.04.14',
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
        summary: '7월 본격 도입될 GA 설계사 1200%룰을 앞두고 일부 대형 GA에서 해촉 설계사에게 과거 성과보상금 환수를 요구하는 사례가 늘어 법적 분쟁 우려가 커지고 있습니다.',
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
        summary: '2026년 실손보험 평균 보험료가 7.8% 인상됩니다. 특히 4세대는 20%대로 가장 큰 폭 인상되는 반면, 1세대는 3%대, 2세대는 5%대 수준입니다.',
        tip: '갱신 예정 고객 리스트를 미리 확인하고 보험료 인상 전 안내 연락을 먼저 하세요. 고객 신뢰를 높이는 좋은 기회입니다!',
      },
    ],
  },
]

// TAG 우선순위 색상
const TAG_ORDER: Record<string, number> = { '신상품': 0, '정책변화': 1, '통계': 2, '주의사항': 3 }

export default function Newsletter() {
  const router = useRouter()

  // 모바일 상태
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedTip, setExpandedTip] = useState<number | null>(null)

  // PC 상태
  const [pcWeekId, setPcWeekId] = useState<string>(NEWSLETTERS[0]?.id ?? '')
  const [pcExpandedTip, setPcExpandedTip] = useState<number | null>(null)

  useEffect(() => {
    if (selectedId) window.history.pushState({ newsletterId: selectedId }, '')
  }, [selectedId])

  useEffect(() => {
    const handlePopState = () => setSelectedId(null)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const pcWeek = NEWSLETTERS.find(n => n.id === pcWeekId)

  const selectedNewsletter = NEWSLETTERS.find(n => n.id === selectedId)

  // ── PC 레이아웃 ────────────────────────────────────────────
  const pcLayout = (
    <div className={s.pcWrap}>
      {/* 페이지 헤더 */}
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>뉴스레터</h1>
        <span className={s.pageBadge}>매주 월요일 업데이트</span>
        <p className={s.pageSub}>설계사를 위한 핵심 보험 뉴스</p>
      </div>

      {/* 2열 */}
      <div className={s.twoCol}>

        {/* 1열: 주차 목록 */}
        <div className={s.colWeeks}>
          <div className={s.colHeader}>발행 목록</div>
          {NEWSLETTERS.map(nl => (
            <div
              key={nl.id}
              className={[s.weekRow, nl.id === pcWeekId ? s.weekRowActive : ''].join(' ')}
              onClick={() => { setPcWeekId(nl.id); setPcExpandedTip(null) }}
            >
              <div className={s.weekLabel}>{nl.week}</div>
              <div className={s.weekMeta}>
                <span className={s.weekDate}>{nl.date}</span>
                <span className={s.weekCount}>{nl.items.length}건</span>
              </div>
            </div>
          ))}
        </div>

        {/* 2열: 아티클 상세 */}
        <div className={s.colContent}>
          {pcWeek ? (
            <>
              <div className={s.contentHeader}>
                <div className={s.contentTitle}>이번 주 꼭 알아야 할 보험 뉴스</div>
                <div className={s.contentMeta}>아이플래너 주간 보험 브리핑 · {pcWeek.week} · {pcWeek.date}</div>
              </div>

              {pcWeek.items.map((item, i) => (
                <div
                  key={i}
                  className={s.articleItem}
                  onClick={() => setPcExpandedTip(pcExpandedTip === i ? null : i)}
                >
                  <div className={s.articleTop}>
                    <span className={s.articleNum}>{i + 1}</span>
                    <div className={s.articleBody}>
                      <div className={s.articleTagRow}>
                        <span
                          className={s.articleTag}
                          style={{ color: item.tagColor, background: item.tagBg }}
                        >
                          {item.tag}
                        </span>
                        <span className={s.articleTitle}>{item.title}</span>
                      </div>
                      <p className={s.articleSummary}>{item.summary}</p>
                      {(item as any).source && (
                        <div className={s.articleSource}>출처: {(item as any).source}</div>
                      )}
                      {pcExpandedTip === i && (
                        <div className={s.articleTip}>
                          <span className={s.articleTipIcon}>💡</span>
                          <span className={s.articleTipText}>
                            <strong>설계사 활용 팁</strong>{item.tip}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={[s.articleChevron, pcExpandedTip === i ? s.articleChevronOpen : ''].join(' ')}>›</span>
                  </div>
                </div>
              ))}

              <div className={s.footerNote}>
                아이플래너 보험 브리핑 · 매주 월요일 발송<br />
                본 뉴스레터는 아이플래너가 설계사님을 위해 자동으로 수집·요약한 내용입니다
              </div>
            </>
          ) : (
            <div className={s.emptyState}>
              <span>📰</span>
              <span>주차를 선택하면<br />뉴스를 확인할 수 있어요</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── 상세 화면 (모바일) ─────────────────────────────────────
  if (selectedNewsletter) {
    return (
      <>
      {pcLayout}
      <div className={s.mobileLayout} style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', background: '#FAF9F5', minHeight: '100vh' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderBottom: '1px solid #EDEBE4', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={() => setSelectedId(null)}
            style={{ background: 'none', border: 'none', fontSize: 14, color: '#1D9E75', cursor: 'pointer', padding: '4px 0', fontWeight: 500 }}>
            ← 목록
          </button>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>{selectedNewsletter.week}</span>
        </div>

        {/* 타이틀 */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #EDEBE4', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 3, height: 14, background: '#1D9E75', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>이번 주 꼭 알아야 할 보험 뉴스</span>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 11, marginTop: 4 }}>
            아이플래너 주간 보험 브리핑 · {selectedNewsletter.date}
          </p>
        </div>

        {/* 뉴스 아이템 — 노션 리스트 스타일 */}
        <div style={{ background: '#fff', marginTop: 8 }}>
          {selectedNewsletter.items.map((item, i) => (
            <div key={i} style={{ borderBottom: i < selectedNewsletter.items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              {/* 메인 행 */}
              <div style={{ padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => setExpandedTip(expandedTip === i ? null : i)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* 번호 */}
                  <span style={{ fontSize: 12, color: '#C7C7CC', fontWeight: 600, marginTop: 2, flexShrink: 0, width: 16, textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 태그 + 제목 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700, color: item.tagColor, background: item.tagBg, flexShrink: 0 }}>
                        {item.tag}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>{item.title}</span>
                    </div>
                    {/* 요약 */}
                    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, margin: 0 }}>{item.summary}</p>
                    {(item as any).source && (
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.4 }}>출처: {(item as any).source}</p>
                    )}
                  </div>
                  {/* 펼치기 화살표 */}
                  <span style={{ fontSize: 13, color: '#C7C7CC', flexShrink: 0, marginTop: 2, transition: 'transform 0.2s', transform: expandedTip === i ? 'rotate(90deg)' : 'none' }}>›</span>
                </div>
              </div>

              {/* 설계사 팁 — 펼치면 나타남 */}
              {expandedTip === i && (
                <div style={{ margin: '0 16px 14px 42px', background: '#F0FDF9', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid #1D9E75' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                    <span style={{ fontSize: 12, color: '#1D9E75', lineHeight: 1.65 }}>
                      <strong>설계사 활용 팁</strong> {item.tip}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: '#C7C7CC', lineHeight: 1.8 }}>
          <p>아이플래너 보험 브리핑 · 매주 월요일 발송</p>
          <p>본 뉴스레터는 아이플래너가 설계사님을 위해 자동으로 수집·요약한 내용입니다</p>
        </div>
      </div>
      </>
    )
  }

  // ── 목록 화면 (모바일) + PC 레이아웃 ──────────────────────
  return (
    <>
      {/* PC 전용 */}
      {pcLayout}

      {/* 모바일 전용 */}
      <div className={s.mobileLayout} style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', background: '#FAF9F5', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ padding: '16px 16px 12px', background: '#fff', borderBottom: '1px solid #EDEBE4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 3, height: 16, background: '#1D9E75', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>📰 보험 브리핑</span>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 11 }}>매주 월요일 업데이트 · 설계사를 위한 핵심 뉴스 요약</p>
      </div>

      {/* 뉴스레터 목록 — 노션 게시판 스타일 */}
      <div style={{ background: '#fff', marginTop: 8 }}>
        {NEWSLETTERS.map((nl, idx) => (
          <div key={nl.id}>
            {/* 주차 구분선 헤더 */}
            <div style={{ padding: '10px 16px 6px', background: '#FAF9F5', borderBottom: '1px solid #EDEBE4', borderTop: idx > 0 ? '6px solid #FAF9F5' : 'none' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{nl.week} · {nl.date}</span>
            </div>

            {/* 뉴스 아이템 행들 */}
            {nl.items.map((item, i) => (
              <div key={i}
                onClick={() => setSelectedId(nl.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 16px',
                  borderBottom: '1px solid #F3F4F6',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  overflow: 'hidden',
                  minWidth: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* 번호 */}
                <span style={{ fontSize: 11, color: '#C7C7CC', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                {/* 태그 */}
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700, color: item.tagColor, background: item.tagBg, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {item.tag}
                </span>
                {/* 제목 */}
                <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, flex: 1, minWidth: 0, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </span>
                {/* 화살표 */}
                <span style={{ fontSize: 14, color: '#D1D5DB', flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', margin: '8px 10px', background: '#F0FDF9', borderRadius: 10, fontSize: 12, color: '#1D9E75' }}>
        <span>🤖</span>
        <span>매주 월요일 AI가 보험업계 뉴스를 자동으로 수집·정리합니다</span>
      </div>
    </div>
    </>
  )
}
