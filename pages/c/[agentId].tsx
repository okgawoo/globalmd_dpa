import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

export default function BusinessCard() {
  const router = useRouter()
  const { agentId } = router.query
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [kakaCopied, setKakaCopied] = useState(false)

  useEffect(() => {
    if (!agentId) return
    fetchAgent()
  }, [agentId])

  useEffect(() => {
    if (!agentId) return
    const cardUrl = `${window.location.origin}/c/${agentId}`
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(cardUrl)}&color=1D9E75&bgcolor=ffffff`)
  }, [agentId])

  async function fetchAgent() {
    const { data } = await supabase
      .from('dpa_agents')
      .select('name, phone, personal_email, kakao_id, address, profile_image_url')
      .eq('slug', agentId)
      .eq('status', 'approved')
      .single()
    setAgent(data)
    setLoading(false)
  }

  function downloadVCard() {
    if (!agent) return
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${agent.name}`,
      `TEL;TYPE=CELL:${agent.phone || ''}`,
      agent.personal_email ? `EMAIL:${agent.personal_email}` : '',
      'ORG:보험설계사',
      `NOTE:DPA 보험관리 플랫폼`,
      'END:VCARD'
    ].filter(Boolean).join('\n')
    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent.name}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyKakaoId() {
    if (!agent?.kakao_id) return
    await navigator.clipboard.writeText(agent.kakao_id)
    setKakaCopied(true)
    setTimeout(() => setKakaCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>불러오는 중...</div>
    </div>
  )

  if (!agent) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😢</div>
        <div style={{ fontSize: 16, color: '#374151', fontWeight: 600 }}>존재하지 않는 명함이에요</div>
      </div>
    </div>
  )

  const initials = agent.name?.slice(0, 1) || '?'

  return (
    <>
      <Head>
        <title>{agent.name} 설계사 명함</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="description" content={`${agent.name} 보험설계사 전자명함`} />
      </Head>

      <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 360, fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>

          {/* 명함 카드 */}
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

            {/* 상단 헤더 */}
            <div style={{ background: '#1D9E75', padding: '28px 24px 24px', position: 'relative' }}>
              {/* DPA 로고 */}
              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                <svg width="12" height="12" viewBox="0 0 40 40" fill="none">
                  <path d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M20 30C17.5 30 15 28 15 25C15 22 17 20 20 20C23 20 25 22 25 25" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="20" cy="20" r="2.5" fill="white"/>
                </svg>
                <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>DPA</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* 프로필 사진 or 이니셜 */}
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {agent.profile_image_url ? (
                    <img src={agent.profile_image_url} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'white', fontSize: 24, fontWeight: 500 }}>{initials}</span>
                  )}
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px' }}>{agent.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 3 }}>보험설계사</div>
                </div>
              </div>
            </div>

            {/* 연락처 정보 */}
            <div style={{ padding: '20px 24px 0' }}>
              {agent.phone && (
                <a href={`tel:${agent.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.01 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>전화번호</div>
                    <div style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>{agent.phone}</div>
                  </div>
                </a>
              )}

              {agent.personal_email && (
                <a href={`mailto:${agent.personal_email}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>이메일</div>
                    <div style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>{agent.personal_email}</div>
                  </div>
                </a>
              )}

              {agent.kakao_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>💬</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>카카오톡</div>
                    <div style={{ fontSize: 15, color: '#111827', fontWeight: 500 }}>{agent.kakao_id}</div>
                  </div>
                </div>
              )}
            </div>

            {/* QR 코드 + 버튼 */}
            <div style={{ padding: '16px 24px 24px', borderTop: '1px solid #F3F4F6', marginTop: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* QR 코드 */}
              {qrUrl && (
                <div style={{ width: 80, height: 80, borderRadius: 10, border: '1px solid #E5E7EB', padding: 6, flexShrink: 0, background: '#fff' }}>
                  <img src={qrUrl} width={68} height={68} alt="QR코드" style={{ borderRadius: 6 }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>QR 스캔으로 연락처 저장</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={downloadVCard} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    연락처 저장
                  </button>
                  {agent.kakao_id && (
                    <button onClick={copyKakaoId} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #FEE500', background: '#FEE500', color: '#3C1E1E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {kakaCopied ? '복사됨 ✓' : '카카오 ID 복사'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 URL */}
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>
            powered by DPA
          </div>
        </div>
      </div>
    </>
  )
}
