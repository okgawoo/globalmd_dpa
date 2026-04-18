import { useState, useEffect, useRef } from 'react'
import styles from '../styles/Input.module.css'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

export default function CardPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoSlide, setPhotoSlide] = useState(false)

  // 고객 정보 수집 설정
  const [collectName, setCollectName] = useState(true)
  const [collectPhone, setCollectPhone] = useState(true)
  const [collectBirth, setCollectBirth] = useState(false)

  useEffect(() => {
    loadAgent()
  }, [])

  async function loadAgent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data } = await supabase.from('dpa_agents').select('*').eq('user_id', user.id).single()
    if (data) {
      setAgent(data)
      const settings = data.settings || {}
      setCollectName(settings.collect_name !== false)
      setCollectPhone(settings.collect_phone !== false)
      setCollectBirth(settings.collect_birth === true)
      const cardUrl = `${window.location.origin}/c/${data.slug}`
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(cardUrl)}&color=1D9E75&bgcolor=ffffff`)
    }
    setLoading(false)
  }

  async function handleImageUpload(file: File) {
    if (!file || !agent) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `profiles/${agent.id}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('dpa_agents').update({ profile_image_url: publicUrl }).eq('id', agent.id)
      setAgent({ ...agent, profile_image_url: publicUrl })
    } catch (e) {
      alert('사진 업로드 중 오류가 발생했어요!')
    }
    setUploading(false)
  }

  async function saveSettings() {
    if (!agent) return
    setSaving(true)
    const settings = {
      ...agent.settings,
      collect_name: collectName,
      collect_phone: collectPhone,
      collect_birth: collectBirth,
    }
    await supabase.from('dpa_agents').update({ settings }).eq('id', agent.id)
    setAgent({ ...agent, settings })
    setSaving(false)
    alert('저장됐어요! 😊')
  }

  async function copyUrl() {
    if (!agent?.slug) return
    const url = `${window.location.origin}/c/${agent.slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareCard() {
    if (!agent?.slug) return
    const url = `${window.location.origin}/c/${agent.slug}`
    if (navigator.share) {
      await navigator.share({ title: `${agent.name} 설계사 명함`, url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('링크가 복사됐어요!')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ fontSize: 14, color: '#9CA3AF' }}>불러오는 중...</div>
    </div>
  )

  const cardUrl = agent?.slug ? `https://globalmd-dpa.vercel.app/c/${agent.slug}` : ''
  const initials = agent?.name?.slice(0, 1) || '?'

  return (
    <>
      <Head><title>전자명함 관리</title></Head>
      <div className={styles.formWrap}>

        {/* 명함 미리보기 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', marginBottom: 10 }}>📇 내 명함 미리보기</div>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 16 }}>
          <div style={{ background: '#1D9E75', padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* 프로필 사진 */}
              <div
                onClick={() => setPhotoSlide(true)}
                style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                {agent?.profile_image_url ? (
                  <img src={agent.profile_image_url} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: 'white', fontSize: 22, fontWeight: 500 }}>{initials}</span>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10 }}>📷</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }} />
              <div>
                <div style={{ color: 'white', fontSize: 20, fontWeight: 600 }}>{agent?.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>보험설계사</div>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 20px 16px' }}>
            {agent?.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>전화번호</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{agent.phone}</div>
                </div>
              </div>
            )}
            {agent?.personal_email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>✉️</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>이메일</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{agent.personal_email}</div>
                </div>
              </div>
            )}
            {agent?.kakao_id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>💬</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>카카오톡</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{agent.kakao_id}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 사진 업로드 안내 */}
        {uploading && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#1D9E75', marginBottom: 12 }}>사진 업로드 중...</div>
        )}
        <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 }}>
          📷 프로필 사진을 탭해서 변경하세요
        </div>

        {/* QR + URL 공유 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', marginBottom: 12 }}>🔗 명함 공유</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {qrUrl && (
              <div style={{ width: 80, height: 80, borderRadius: 10, border: '1px solid #E5E7EB', padding: 5, flexShrink: 0, background: '#fff' }}>
                <img src={qrUrl} width={70} height={70} alt="QR코드" style={{ borderRadius: 6 }} />
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all', background: '#F9FAFB', padding: '6px 10px', borderRadius: 8 }}>
                {cardUrl}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={copyUrl} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: copied ? '#D1FAE5' : '#1D9E75', color: copied ? '#065F46' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {copied ? '✓ 복사됨' : '🔗 URL복사'}
                </button>
                <button onClick={shareCard} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #1D9E75', background: '#E8F8F2', color: '#1D9E75', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  📤 공유하기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 고객 정보 수집 설정 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', marginBottom: 16, border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', marginBottom: 4 }}>📋 고객 정보 수집 설정</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 14 }}>고객이 명함 페이지에서 입력할 수 있는 정보를 선택하세요</div>

          {[
            { label: '이름', desc: '필수 항목', value: collectName, set: setCollectName, disabled: true },
            { label: '연락처', desc: '010-0000-0000', value: collectPhone, set: setCollectPhone, disabled: false },
            { label: '생년월일', desc: '예: 1990.01.01', value: collectBirth, set: setCollectBirth, disabled: false },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.desc}</div>
              </div>
              <div
                onClick={() => !item.disabled && item.set(!item.value)}
                style={{ width: 44, height: 24, borderRadius: 12, background: item.value ? '#1D9E75' : '#E5E7EB', cursor: item.disabled ? 'default' : 'pointer', position: 'relative', transition: 'background 0.2s', opacity: item.disabled ? 0.6 : 1 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: item.value ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </div>
          ))}

          <button onClick={saveSettings} disabled={saving} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: 'none', background: '#1D9E75', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '저장 중...' : '✅ 설정 저장'}
          </button>
        </div>

        {/* 고객 명함 페이지 바로가기 */}
        <button onClick={() => window.open(cardUrl, '_blank')} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid #1D9E75', background: '#E8F8F2', color: '#1D9E75', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          👀 고객 화면으로 보기
        </button>
      </div>

      {/* 프로필 사진 슬라이드업 */}
      {photoSlide && (
        <>
          <div onClick={() => setPhotoSlide(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FAF9F5', borderRadius: '20px 20px 0 0', zIndex: 1001, padding: '20px 20px 40px', animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#EDEBE4', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16, textAlign: 'center' }}>프로필 사진 변경</div>
            <button onClick={() => { fileInputRef.current?.click(); setPhotoSlide(false) }}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#1D9E75', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
              📷 사진 선택하기
            </button>
            {agent?.profile_image_url && (
              <button onClick={async () => {
                await supabase.from('dpa_agents').update({ profile_image_url: null }).eq('id', agent.id)
                setAgent({ ...agent, profile_image_url: null })
                setPhotoSlide(false)
              }}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
                🗑️ 사진 삭제
              </button>
            )}
            <button onClick={() => setPhotoSlide(false)}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              취소
            </button>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
        </>
      )}
    </>
  )
}
