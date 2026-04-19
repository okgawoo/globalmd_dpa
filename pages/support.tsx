import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isQuickReply?: boolean
}

// 마크다운 렌더링 함수
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
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

// 1차 카테고리
const CATEGORIES_L1 = [
  { id: 'data', label: '📊 데이터 입력' },
  { id: 'customer', label: '👥 고객 관리' },
  { id: 'sms', label: '📨 문자 발송' },
  { id: 'sender', label: '📞 발신번호 인증' },
  { id: 'newsletter', label: '📰 뉴스레터' },
  { id: 'etc', label: '❓ 기타 문의' },
]

// 2차 카테고리
const CATEGORIES_L2: Record<string, { id: string; label: string }[]> = {
  data: [
    { id: 'data_input', label: '복불 입력 방법' },
    { id: 'data_card', label: '명함 입력 방법' },
    { id: 'data_manual', label: '수동 입력 방법' },
    { id: 'data_etc', label: '기타 질문' },
  ],
  customer: [
    { id: 'customer_my', label: '마이고객 관리' },
    { id: 'customer_prospect', label: '관심고객 관리' },
    { id: 'customer_edit', label: '고객 정보 수정' },
    { id: 'customer_etc', label: '기타 질문' },
  ],
  sms: [
    { id: 'sms_ai', label: 'AI 추천 문자' },
    { id: 'sms_bulk', label: '단체문자 발송' },
    { id: 'sms_history', label: '발송 이력 확인' },
    { id: 'sms_etc', label: '기타 질문' },
  ],
  sender: [
    { id: 'sender_register', label: '발신번호 등록 방법' },
    { id: 'sender_doc', label: '필요 서류 안내' },
    { id: 'sender_status', label: '등록 현황 확인' },
    { id: 'sender_etc', label: '기타 질문' },
  ],
  newsletter: [
    { id: 'newsletter_send', label: '뉴스레터 발송' },
    { id: 'newsletter_template', label: '템플릿 사용법' },
    { id: 'newsletter_etc', label: '기타 질문' },
  ],
  etc: [
    { id: 'etc_account', label: '계정 관련' },
    { id: 'etc_error', label: '오류/버그 신고' },
    { id: 'etc_suggestion', label: '기능 제안' },
    { id: 'etc_other', label: '직접 입력' },
  ],
}

export default function SupportPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! DPA 고객센터입니다 😊\n어떤 도움이 필요하신가요?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [escalated, setEscalated] = useState(false)
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, step])

  // 1차 카테고리 선택
  function selectL1(cat: { id: string; label: string }) {
    setSelectedL1(cat.id)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: cat.label, isQuickReply: true },
      { role: 'assistant', content: `${cat.label} 관련해서 어떤 점이 궁금하신가요?` }
    ])
    setStep('l2')
  }

  // 2차 카테고리 선택
  async function selectL2(cat: { id: string; label: string }) {
    if (cat.id.endsWith('_etc') || cat.id === 'etc_other') {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: cat.label, isQuickReply: true },
        { role: 'assistant', content: '궁금하신 내용을 직접 입력해 주세요! 😊' }
      ])
      setStep('chat')
      return
    }

    const userMsg = cat.label
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMsg, isQuickReply: true },
    ]
    setMessages(newMessages)
    setStep('chat')
    setLoading(true)

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          agentName,
          messages: [{ role: 'user', content: userMsg }],
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송해요, 잠시 후 다시 시도해주세요. 🙏' }])
    } finally {
      setLoading(false)
    }
  }

  // 직접 입력 발송
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
        body: JSON.stringify({ agentId, agentName, messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송해요, 잠시 후 다시 시도해주세요. 🙏' }])
    } finally {
      setLoading(false)
    }
  }

  // 담당자 연결
  async function handleEscalate() {
    setLoading(true)
    try {
      await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, agentName, messages, escalate: true }),
      })
      setEscalated(true)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '담당자에게 연결 요청을 보냈어요! 😊\n빠른 시간 내에 연락드리겠습니다.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', background: '#FAF9F5' }}>

        {/* 채팅 메시지 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
              )}
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? (msg.isQuickReply ? '#E1F5EE' : '#1D9E75') : '#fff',
                color: msg.role === 'user' ? (msg.isQuickReply ? '#065F46' : '#fff') : '#1a1a1a',
                fontSize: 14,
                lineHeight: 1.6,
                border: msg.role === 'assistant' ? '1px solid #EDEBE4' : 'none',
              }}>
                {renderMarkdown(msg.content)}
              </div>
            </div>
          ))}

          {/* 로딩 */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#fff', border: '1px solid #EDEBE4' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#999' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1차 카테고리 버튼 */}
          {step === 'l1' && !loading && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {CATEGORIES_L1.map(cat => (
                <button key={cat.id} onClick={() => selectL1(cat)}
                  style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #1D9E75', background: '#fff', color: '#1D9E75', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 2차 카테고리 버튼 */}
          {step === 'l2' && !loading && selectedL1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {CATEGORIES_L2[selectedL1]?.map(cat => (
                <button key={cat.id} onClick={() => selectL2(cat)}
                  style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #1D9E75', background: '#fff', color: '#1D9E75', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* 담당자 연결 버튼 */}
          {step === 'chat' && messages.length >= 5 && !escalated && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <button onClick={handleEscalate}
                style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #EDEBE4', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' }}>
                🙋 담당자 연결 요청
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 입력창 (chat 단계에서만 표시) */}
        {step === 'chat' && (
          <div style={{ background: '#fff', borderTop: '1px solid #EDEBE4', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="궁금한 점을 입력하세요..."
              rows={1}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #EDEBE4', fontSize: 14, resize: 'none', lineHeight: 1.5, background: '#FAF9F5', outline: 'none' }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: input.trim() && !loading ? '#1D9E75' : '#D1D5DB', color: '#fff', fontSize: 18, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ↑
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
