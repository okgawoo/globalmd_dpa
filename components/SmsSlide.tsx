import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type ToneType = '정중' | '친근' | '애교' | '간결'

const TONES: ToneType[] = ['정중', '친근', '애교', '간결']
const EMOJIS = ['😊','😄','🎂','🎉','🎊','💚','📞','🙏','👍','✅','🔥','💪','⭐','🌟','❤️']

// 스크립트 타입별 템플릿
const SCRIPTS: Record<string, Record<ToneType, string>> = {
  일반: {
    정중: '안녕하세요 {name} 님,\n담당 설계사입니다.\n궁금하신 점이 있으시면 편하신 시간에 연락 주시기 바랍니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n담당 설계사예요!\n궁금하신 거 있으시면 언제든 연락주세요~',
    애교: '{name} 님~ 안녕하세요! 😊\n항상 잘 지내고 계시죠?\n무엇이든 필요하신 거 있으면 연락주세요 💚',
    간결: '{name} 님, 안녕하세요. 담당 설계사입니다. 연락 주세요.',
  },
  생일: {
    정중: '{name} 님, 오늘 생신을 진심으로 축하드립니다.\n항상 건강하시고 행복하신 날 되시길 바랍니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n오늘 생일이에요! 🎂\n항상 건강하고 행복하세요!',
    애교: '{name} 님~ 생일 축하해요! 🎂🎉\n오늘 하루 정말 특별한 날 되세요!\n항상 곁에서 응원할게요 💚',
    간결: '{name} 님, 생일 축하드립니다! 🎂 건강한 하루 되세요 😊',
  },
  완납임박: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험의 납입이 곧 완료될 예정입니다.\n완납 후 더 유리한 조건으로 재설계를 검토해 드릴 수 있습니다.\n편하신 시간에 말씀 주시면 연락드리겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n납입이 거의 다 됐어요! 🎉\n완납 후 더 좋은 조건으로 재설계할 수 있어요.\n시간 되실 때 한번 얘기 나눠요!',
    애교: '{name} 님~ 드디어 완납 임박이에요! 🎊\n정말 수고 많으셨어요!\n완납 후 더 좋은 혜택으로 바꿔드릴 수 있어요 💚',
    간결: '{name} 님, 보험 완납이 임박했습니다. 재설계 상담 원하시면 연락 주세요.',
  },
  보장공백: {
    정중: '안녕하세요 {name} 님,\n보험 검토 중 보장 공백이 확인되었습니다.\n보장 강화를 위해 한번 상담해 드리고 싶습니다.\n편하신 시간에 말씀 주시면 감사하겠습니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n보험을 확인해보니 보장 공백이 있어서요.\n시간 되실 때 통화 한번 해도 될까요? 📞',
    애교: '{name} 님~ 보험 확인하다가 보장 공백을 발견했어요! 😮\n더 잘 지켜드리고 싶어서 연락드렸어요 💚\n잠깐 통화 가능하실까요?',
    간결: '{name} 님, 보장 공백이 확인됐습니다. 상담 원하시면 연락 주세요. 📞',
  },
  만기임박: {
    정중: '안녕하세요 {name} 님,\n가입하신 보험이 곧 만기가 도래합니다.\n만기 후 보장 공백이 발생하지 않도록 미리 안내드립니다.\n편하신 시간에 상담 부탁드립니다.\n- 담당 설계사 드림',
    친근: '안녕하세요 {name} 님! 😊\n가입하신 보험이 곧 만기가 돼요!\n미리 알려드리려고 연락드렸어요. 시간 되실 때 통화해요!',
    애교: '{name} 님~ 보험 만기가 다가오고 있어요! ⏰\n보장 공백 없이 잘 챙겨드리고 싶어서요 💚',
    간결: '{name} 님, 보험 만기가 임박했습니다. 재가입 상담 원하시면 연락 주세요.',
  },
}

interface SmsSlidePanelProps {
  isOpen: boolean
  onClose: () => void
  customer: any // { id, name, phone, ... }
  scriptType?: string // '일반' | '생일' | '완납임박' | '보장공백' | '만기임박'
  agentId?: string
}

export default function SmsSlidePanels({ isOpen, onClose, customer, scriptType = '일반', agentId }: SmsSlidePanelProps) {
  const [tone, setTone] = useState<ToneType>('친근')
  const [scriptText, setScriptText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const isDragging = useRef(false)

  // 열릴 때 스크립트 자동 생성
  useEffect(() => {
    if (isOpen && customer) {
      setAiLoading(true)
      setTimeout(() => {
        const tpl = SCRIPTS[scriptType]?.[tone] || SCRIPTS['일반'][tone]
        setScriptText(tpl.replace(/{name}/g, customer.name))
        setAiLoading(false)
      }, 400)
    }
  }, [isOpen, customer, scriptType])

  // 톤 변경
  function changeTone(t: ToneType) {
    setTone(t)
    if (!customer) return
    setAiLoading(true)
    setTimeout(() => {
      const tpl = SCRIPTS[scriptType]?.[t] || SCRIPTS['일반'][t]
      setScriptText(tpl.replace(/{name}/g, customer.name))
      setAiLoading(false)
    }, 300)
  }

  // 이모지 삽입
  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) return setScriptText(prev => prev + emoji)
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = scriptText.slice(0, start) + emoji + scriptText.slice(end)
    setScriptText(next)
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + emoji.length; el.focus() }, 0)
  }

  // 복사
  async function handleCopy() {
    await navigator.clipboard.writeText(scriptText)
    if (agentId && customer?.id) {
      await supabase.from('dpa_messages').insert({
        agent_id: agentId,
        customer_id: customer.id,
        message_type: scriptType,
        is_sent: false,
        sent_script: scriptText,
      })
    }
    alert('복사됐어요! 카톡에 붙여넣으세요 😊')
    onClose()
  }

  // 발송
  async function handleSend() {
    if (!scriptText) return
    setSending(true)
    try {
      if (agentId && customer?.id) {
        await supabase.from('dpa_messages').insert({
          agent_id: agentId,
          customer_id: customer.id,
          message_type: scriptType,
          is_sent: true,
          sent_script: scriptText,
        })
      }
      alert(`${customer?.name} 님께 발송됐어요! 😊`)
      onClose()
    } catch (e) {
      alert('발송 중 오류가 발생했어요.')
    }
    setSending(false)
  }

  // 스와이프 다운으로 닫기
  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      startY.current = e.touches[0].clientY
      isDragging.current = true
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) el.style.transform = `translateY(${dy}px)`
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return
      isDragging.current = false
      const dy = e.changedTouches[0].clientY - startY.current
      el.style.transform = ''
      el.style.transition = 'transform 0.3s ease'
      if (dy > 80) onClose()
      setTimeout(() => { el.style.transition = '' }, 300)
    }

    el.addEventListener('touchstart', onTouchStart)
    el.addEventListener('touchmove', onTouchMove)
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 1000, animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* 슬라이드 패널 */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          zIndex: 1001,
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* 핸들바 */}
        <div style={{display:'flex', justifyContent:'center', padding:'12px 0 4px', cursor:'pointer', flexShrink:0}} onClick={onClose}>
          <div style={{width:40, height:4, borderRadius:2, background:'var(--border)'}} />
        </div>

        {/* 헤더 */}
        <div style={{display:'flex', alignItems:'center', padding:'8px 16px 12px', borderBottom:'1px solid var(--border)', flexShrink:0}}>
          <div style={{width:36, height:36, borderRadius:'50%', background:'var(--green-light)', color:'var(--green)', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', marginRight:10}}>
            {customer?.name?.slice(0,2) || '??'}
          </div>
          <div>
            <div style={{fontWeight:700, fontSize:15, color:'var(--text-primary)'}}>{customer?.name || '고객'}</div>
            <div style={{fontSize:12, color:'var(--text-secondary)'}}>{customer?.phone || '연락처 없음'}</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto', background:'none', border:'none', fontSize:20, color:'var(--text-muted)', cursor:'pointer', padding:'4px 8px'}}>✕</button>
        </div>

        {/* 스크롤 영역 */}
        <div style={{overflowY:'auto', flex:1, padding:'12px 16px'}}>

          {/* AI 배지 */}
          <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
            <div style={{width:8, height:8, borderRadius:'50%', background: aiLoading ? '#FCD34D' : '#1D9E75', animation: aiLoading ? 'pulse 1s infinite' : 'none'}} />
            <span style={{fontSize:12, color:'var(--text-secondary)'}}>
              {aiLoading ? 'AI 스크립트 작성중...' : 'AI 추천 스크립트'}
            </span>
          </div>

          {/* 톤 버튼 */}
          <div style={{display:'flex', gap:6, marginBottom:12}}>
            {TONES.map(t => (
              <button key={t} onClick={() => changeTone(t)} style={{
                padding:'5px 12px', borderRadius:16, fontSize:12, fontWeight:600,
                border: 'none', cursor:'pointer',
                background: tone === t ? '#1D9E75' : 'var(--bg)',
                color: tone === t ? 'white' : 'var(--text-secondary)',
              }}>{t}</button>
            ))}
          </div>

          {/* 스크립트 입력 */}
          <div style={{background:'var(--bg)', borderRadius:12, padding:12, marginBottom:10}}>
            <textarea
              ref={textareaRef}
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              rows={7}
              style={{
                width:'100%', border:'none', background:'transparent',
                fontSize:14, lineHeight:1.6, color:'var(--text-primary)',
                resize:'none', outline:'none', fontFamily:'inherit',
              }}
              placeholder="스크립트를 작성해주세요..."
            />
          </div>

          {/* 이모지 */}
          <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:12}}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => insertEmoji(e)} style={{
                background:'var(--bg)', border:'1px solid var(--border)',
                borderRadius:8, padding:'4px 6px', fontSize:16, cursor:'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>

        {/* 발송 버튼 */}
        <div style={{display:'flex', gap:10, padding:'12px 16px 24px', borderTop:'1px solid var(--border)', flexShrink:0}}>
          <button onClick={handleCopy} style={{
            flex:1, padding:'13px', borderRadius:12,
            border:'1px solid #1D9E75', background:'var(--bg-card)',
            color:'#1D9E75', fontSize:15, fontWeight:700, cursor:'pointer',
          }}>📋 복사</button>
          <button onClick={handleSend} disabled={sending || !scriptText} style={{
            flex:2, padding:'13px', borderRadius:12,
            border:'none', background: '#1D9E75',
            color:'white', fontSize:15, fontWeight:700, cursor:'pointer',
            opacity: sending ? 0.7 : 1,
          }}>{sending ? '발송 중...' : '📱 발송하기'}</button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </>
  )
}
