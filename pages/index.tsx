import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '../styles/Dashboard.module.css'

export default function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, contracts: 0, nearDone: 0, gap: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    const { data: custs } = await supabase.from('dpa_customers').select('id')
    const { data: conts } = await supabase.from('dpa_contracts').select('id, payment_rate, payment_status')
    const nearDone = (conts || []).filter((c: any) => c.payment_rate >= 90 && c.payment_status !== '완납').length
    setStats({ customers: (custs || []).length, contracts: (conts || []).length, nearDone, gap: 1 })
    setLoading(false)
  }

  const features = [
    '📊 보장 공백 분석', '💬 카톡 스크립트 자동생성', '🔔 완납 임박 알림',
    '🎂 생일 알림', '📰 맞춤 뉴스레터', '⏰ 만기 임박 알림',
    '🤖 AI 보장 분석', '📱 캡처 자동 입력', '📈 영업 성과 리포트', '🎯 잠재 고객 관리'
  ]

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.featureBtns}>
        {features.map(f => (
          <button key={f} className={styles.featBtn} onClick={() => alert('준비 중인 기능이에요! 곧 추가됩니다 😊')}>{f}</button>
        ))}
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.mlabel}>총 고객</div>
          <div className={styles.mvalue}>{stats.customers}</div>
          <div className={styles.msub}>기존 고객</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>보험 계약</div>
          <div className={styles.mvalue}>{stats.contracts}</div>
          <div className={styles.msub}>총 계약 건수</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>완납 임박</div>
          <div className={[styles.mvalue, styles.red].join(' ')}>{stats.nearDone}</div>
          <div className={styles.msub}>납입률 90%↑</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.mlabel}>보장 공백</div>
          <div className={[styles.mvalue, styles.amber].join(' ')}>{stats.gap}</div>
          <div className={styles.msub}>뇌혈관 미가입</div>
        </div>
      </div>

      <div className={styles.alertsTitle}>오늘의 액션 알림</div>
      <div className={styles.alerts}>
        <div className={[styles.alertCard, styles.acRed].join(' ')}>
          <div className={styles.alertIcon}>⚠</div>
          <div className={styles.alertTitle}>뇌혈관 보장 공백</div>
          <div className={styles.alertDesc}>지점종 님 — 뇌출혈만 가입, 확대 제안 필요</div>
        </div>
        <div className={[styles.alertCard, styles.acAmber].join(' ')}>
          <div className={styles.alertIcon}>🔥</div>
          <div className={styles.alertTitle}>완납 임박 2명</div>
          <div className={styles.alertDesc}>지점종(교보 92%), 고객A(흥국 91%)</div>
        </div>
        <div className={[styles.alertCard, styles.acGreen].join(' ')}>
          <div className={styles.alertIcon}>★</div>
          <div className={styles.alertTitle}>풀옵션 유지 관리</div>
          <div className={styles.alertDesc}>고객B — 중입자+표적항암+간병인 완비</div>
        </div>
      </div>
    </div>
  )
}
