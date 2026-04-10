import { useState } from 'react'
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
        title: 'KB손보, 4월 신상품 보험료 최대 2% 인하',
        summary: "KB손해보험이 '5·10·10 Young플러스 건강보험'을 출시하며 주요 담보 보험료를 최대 2% 인하했습니다. 30~40대 고객에게 특히 적합한 경쟁력 있는 구조입니다.",
        tip: '보장 공백이 있는 30~40대 고객에게 먼저 안내해보세요!',
      },
      {
        tag: '정책변화',
        tagColor: '#B45309',
        tagBg: '#FEF3E2',
        title: '판매 수수료 개편 — 2027년 1월부터 분급 시작',
        summary: '금융위원회가 보험 판매수수료 분급체계 개편을 확정했습니다. 2027년부터 수수료가 4년에 걸쳐 분할 지급됩니다. 장기 유지율이 높은 설계사에게 오히려 유리한 구조입니다.',
        tip: '지금부터 장기 유지 고객 관리를 더 철저히 해두세요. DPA 알림 기능이 도움됩니다!',
      },
      {
        tag: '주의사항',
        tagColor: '#B91C1C',
        tagBg: '#FCEBEB',
        title: '4월부터 고위험 담보 보장한도 축소 시작',
        summary: '일부 보험사들이 손해율이 높은 담보를 중심으로 7월 이전에 선제적으로 판매를 중단하거나 보장 한도를 낮추고 있습니다.',
        tip: '표적항암·간병인 담보 미가입 고객에게 지금 연락하세요!',
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
        title: '실손보험 4세대 전환 가입자 급증',
        summary: '4세대 실손보험 전환 캠페인 효과로 전환 가입자가 전월 대비 40% 증가했습니다. 기존 1~3세대 가입자에 대한 전환 안내가 중요해졌습니다.',
        tip: '구세대 실손 보유 고객 리스트를 뽑아 전환 상담을 진행해보세요!',
      },
      {
        tag: '신상품',
        tagColor: '#1D9E75',
        tagBg: '#E6F7F1',
        title: '삼성화재, 치매 전용 보험 출시',
        summary: '삼성화재가 경도인지장애부터 중증 치매까지 단계별로 보장하는 치매 전용 보험을 출시했습니다. 50~60대 고령 고객층에 적합합니다.',
        tip: '50대 이상 고객 중 치매 보장이 없는 고객에게 우선 안내하세요!',
      },
      {
        tag: '주의사항',
        tagColor: '#B91C1C',
        tagBg: '#FCEBEB',
        title: '무·저해지 보험 해지환급금 분쟁 증가',
        summary: '무·저해지 보험의 해지환급금 관련 민원이 급증하고 있습니다. 가입 시 설명 의무 강화와 함께 가입자 관리에 주의가 필요합니다.',
        tip: '무·저해지 상품 가입 고객에게 상품 특성을 재안내하고 관리 이력을 남겨두세요!',
      },
    ],
  },
]

export default function Newsletter() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedNewsletter = NEWSLETTERS.find(n => n.id === selectedId)

  if (selectedNewsletter) {
    return (
      <div className={styles.wrap}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => setSelectedId(null)}>
            ← 목록
          </button>
          <span className={styles.detailWeek}>{selectedNewsletter.week}</span>
        </div>

        {/* 뉴스레터 헤더 */}
        <div className={styles.newsletterHeader}>
          <p className={styles.nlWeekLabel}>{selectedNewsletter.week}</p>
          <h1 className={styles.nlTitle}>{selectedNewsletter.title}</h1>
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
            <h2 className={styles.nlCardTitle}>{item.title}</h2>
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
        <h1 className={styles.listTitle}>📰 보험 브리핑</h1>
        <p className={styles.listSubtitle}>매주 월요일 업데이트</p>
      </div>

      {/* 뉴스레터 목록 */}
      {NEWSLETTERS.map((nl) => (
        <div key={nl.id} className={styles.listCard} onClick={() => setSelectedId(nl.id)}>
          <div className={styles.listCardLeft}>
            <span className={styles.listWeek}>{nl.week}</span>
            <p className={styles.listCardTitle}>{nl.title}</p>
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
