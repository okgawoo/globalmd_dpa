import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function SupportPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! DPA 고객센터입니다 😊\n무엇이 궁금하신가요? 편하게 질문해 주세요!' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [escalated, setEscalated] = useState(false)
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
  }, [messages, loading])

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FAF9F5' }}>
        {/* 헤더 */}
        <div style={{ background: '#fff', borderBottom: '1px solid #EDEBE4', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>DPA 고객센터</p>
            <p style={{ fontSize: 12, color: '#1D9E75' }}>● AI 상담 중</p>
          </div>
        </div>

        {/* 채팅 메시지 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#1D9E75' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#1a1a1a',
                fontSize: 14,
                lineHeight: 1.6,
                border: msg.role === 'assistant' ? '1px solid #EDEBE4' : 'none',
                whiteSpace: 'pre-line',
              }}>
                {msg.content}
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
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#999', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 담당자 연결 버튼 */}
          {messages.length >= 3 && !escalated && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <button onClick={handleEscalate}
                style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #EDEBE4', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' }}>
                🙋 담당자 연결 요청
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
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
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </Layout>
  )
}
