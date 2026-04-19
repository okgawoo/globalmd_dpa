import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isQuickReply?: boolean
  isGuide?: boolean
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const cleanLine = line.replace(/^#{1,3}\s+/, '')
    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g)
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j}>{part.slice(2, -2)}</strong>
          }
          return <span key={j}>{part}</span>
        })}
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

const CATEGORIES_L1 = [
  { id: 'sender',   label: '발신번호 인증' },
  { id: 'data',     label: '데이터 입력' },
  { id: 'sms',      label: '문자 발송' },
  { id: 'customer', label: '고객 관리' },
  { id: 'sales',    label: '영업 관리' },
  { id: 'etc',      label: '기타 문의' },
]

const CATEGORIES_L2: Record<string, { id: string; label: string }[]> = {
  sender: [
    { id: 'sender_how',    label: '등록 방법' },
    { id: 'sender_doc',    label: '필요 서류 안내' },
    { id: 'sender_status', label: '등록 현황 확인' },
    { id: 'sender_etc',    label: '기타' },
  ],
  data: [
    { id: 'data_copy',   label: '복붙 입력' },
    { id: 'data_card',   label: '명함 입력' },
    { id: 'data_manual', label: '수동 입력' },
    { id: 'data_etc',    label: '기타' },
  ],
  sms: [
    { id: 'sms_ai',      label: 'AI 추천 문자' },
    { id: 'sms_bulk',    label: '단체문자 발송' },
    { id: 'sms_history', label: '발송 이력 확인' },
    { id: 'sms_etc',     label: '기타' },
  ],
  customer: [
    { id: 'customer_my',       label: '마이고객 관리' },
    { id: 'customer_prospect', label: '관심고객 관리' },
    { id: 'customer_edit',     label: '고객 정보 수정' },
    { id: 'customer_etc',      label: '기타' },
  ],
  sales: [
    { id: 'sales_meeting', label: '미팅 일정 관리' },
    { id: 'sales_history', label: '영업 이력 관리' },
    { id: 'sales_contact', label: '연락할 고객' },
    { id: 'sales_etc',     label: '기타' },
  ],
  etc: [
    { id: 'etc_account',    label: '계정 관련' },
    { id: 'etc_error',      label: '오류/버그 신고' },
    { id: 'etc_suggestion', label: '기능 제안' },
    { id: 'etc_direct',     label: '직접 입력' },
  ],
}

export default function SupportPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! DPA 고객센터입니다 😊\n무엇이 궁금하신가요?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [step, setStep] = useState<'l1' | 'l2' | 'chat'>('l1')
  const [selectedL1, setSelectedL1] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setAgentId(user.id)
    })
    supabase.from('dpa_agents').select('name').single().then(({ data }) => {
      if (data) setAgentName(data.name || '')
    })
  }, [])

  useEffect(() => {
    if (messages.length <= 1) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, step])

  function selectL1(cat: { id: string; label: string }) {
    setSelectedL1(cat.id)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: cat.label, isQuickReply: true },
      { role: 'assistant', content: `${cat.label} 관련해서 어떤 점이 궁금하신가요?` }
    ])
    setStep('l2')
  }

  async function selectL2(cat: { id: string; label: string }) {
    if (cat.id.endsWith('_etc') || cat.id.endsWith('_direct')) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: cat.label, isQuickReply: true },
        { role: 'assistant', content: '궁금하신 내용을 직접 입력해 주세요! 😊' }
      ])
      setStep('chat')
      return
    }
    const newMessages: Message[] = [...messages, { role: 'user', content: cat.label, isQuickReply: true }]
    setMessages(newMessages)
    setStep('chat')
    setLoading(true)
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentName, messages: [{ role: 'user', content: cat.label }], category: CATEGORIES_L1.find(c => c.id === selectedL1)?.label }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송해요, 잠시 후 다시 시도해주세요. 🙏' }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentName, messages: newMessages, category: CATEGORIES_L1.find(c => c.id === selectedL1)?.label }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송해요, 잠시 후 다시 시도해주세요. 🙏' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#FAF9F5' }}>
      <style>{`@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }`}</style>

      {/* 자체 헤더 */}
      <div style={{ background: '#1D9E75', height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>고객센터</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20 }}>● AI 상담 중</span>
      </div>

      {/* 채팅 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {msg.role === 'assistant' && !msg.isGuide && (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🤖</div>
            )}
            <div style={{
              maxWidth: msg.isGuide ? '100%' : '78%',
              padding: msg.isGuide ? '4px 0' : '11px 14px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.isGuide ? 'transparent' : msg.role === 'user' ? (msg.isQuickReply ? '#E1F5EE' : '#1D9E75') : '#fff',
              color: msg.isGuide ? '#999' : msg.role === 'user' ? (msg.isQuickReply ? '#065F46' : '#fff') : '#1a1a1a',
              fontSize: msg.isGuide ? 13 : 14,
              lineHeight: 1.6,
              border: msg.isGuide ? 'none' : msg.role === 'assistant' ? '1px solid #EDEBE4' : 'none',
              boxShadow: msg.isGuide ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🤖</div>
            <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: '#fff', border: '1px solid #EDEBE4' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#ccc', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'l1' && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            {CATEGORIES_L1.map(cat => (
              <button key={cat.id} onClick={() => selectL1(cat)} style={{ padding: '14px 10px', borderRadius: 12, border: '1px solid #EDEBE4', borderBottom: '3px solid #1D9E75', background: '#fff', color: '#1a1a1a', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {step === 'l2' && !loading && selectedL1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
            {CATEGORIES_L2[selectedL1]?.map(cat => (
              <button key={cat.id} onClick={() => selectL2(cat)} style={{ padding: '14px 10px', borderRadius: 12, border: '1px solid #EDEBE4', borderBottom: '3px solid #EDEBE4', background: '#fff', color: '#1a1a1a', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 - 항상 하단 고정, chat 단계에서만 표시 */}
      <div style={{ background: '#fff', borderTop: '1px solid #EDEBE4', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, visibility: step === 'chat' ? 'visible' : 'hidden' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="궁금한 점을 입력하세요..."
            rows={1}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 22, border: '1px solid #EDEBE4', fontSize: 14, resize: 'none', lineHeight: 1.5, background: '#FAF9F5', outline: 'none' }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: input.trim() && !loading ? '#1D9E75' : '#D1D5DB', color: '#fff', fontSize: 20, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ↑
          </button>
        </div>
    </div>
    
  )
}
