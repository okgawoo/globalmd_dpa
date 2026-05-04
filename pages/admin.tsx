import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import styles from '../styles/Admin.module.css'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [validations, setValidations] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'urls' | 'crawl'>('dashboard')

  // 보험사 공시
  const [selectedInsurer, setSelectedInsurer] = useState<string | null>(null)
  const [crawlSelected, setCrawlSelected] = useState<string[]>(['암보험', '질병보험 (뇌/심혈관)']) // 기본: 암+질병
  const [crawling, setCrawling] = useState(false)
  const [crawlResults, setCrawlResults] = useState<any>(null)
  const [meritzPdfs, setMeritzPdfs] = useState<any[]>([])

  const INSURERS = [
    // 손해보험 (9개)
    { id: 'meritz', name: '메리츠화재', type: '손해보험', active: true },
    { id: 'kb', name: 'KB손해', type: '손해보험', active: false },
    { id: 'samsung', name: '삼성화재', type: '손해보험', active: false },
    { id: 'lotte', name: '롯데손해', type: '손해보험', active: false },
    { id: 'heungkuk', name: '흥국화재', type: '손해보험', active: false },
    { id: 'aig', name: 'AIG손보', type: '손해보험', active: false },
    { id: 'lina', name: '라이나손해', type: '손해보험', active: false },
    { id: 'mgs', name: 'MG손해', type: '손해보험', active: false },
    { id: 'hana', name: '하나손해', type: '손해보험', active: false },
    // 생명보험 (11개)
    { id: 'kyobo', name: '교보생명', type: '생명보험', active: false },
    { id: 'dongyang', name: '동양생명', type: '생명보험', active: false },
    { id: 'miraeasset', name: '미래에셋생명', type: '생명보험', active: false },
    { id: 'samsung_life', name: '삼성생명', type: '생명보험', active: false },
    { id: 'shinhan', name: '신한라이프', type: '생명보험', active: false },
    { id: 'hanwha_life', name: '한화생명', type: '생명보험', active: false },
    { id: 'heungkuk_life', name: '흥국생명', type: '생명보험', active: false },
    { id: 'kb_life', name: 'KB라이프', type: '생명보험', active: false },
    { id: 'kdb', name: 'KDB생명', type: '생명보험', active: false },
    { id: 'hana_life', name: '하나생명', type: '생명보험', active: false },
    { id: 'hyundai', name: '현대해상', type: '생명보험', active: false },
  ]

  const CRAWL_CATEGORIES = [
    { srtSq: 6,  name: '암보험' },
    { srtSq: 4,  name: '질병보험 (뇌/심혈관)' },
    { srtSq: 11, name: '생활보험 (간병/치매+반려동물)' },
    { srtSq: 5,  name: '어린이보험' },
    { srtSq: 2,  name: '운전자보험' },
    { srtSq: 7,  name: '상해보험' },
    { srtSq: 3,  name: '통합보험 (실손)' },
    { srtSq: 1,  name: '자동차보험' },
    { srtSq: 8,  name: '연금저축보험' },
    { srtSq: 14, name: '배상책임보험' },
    { srtSq: 10, name: '화재보험' },
    { srtSq: -1, name: '치아보험' },   // 키워드 검색 방식
    { srtSq: -1, name: '사망보험' },   // 키워드 검색 방식
    { srtSq: -1, name: '태아보험' },   // 키워드 검색 방식
  ]
  const fileRef = useRef<HTMLInputElement>(null)

  const [topMenu, setTopMenu] = useState<'대시보드' | '공지사항' | '설계사' | '유튜브' | '보험공시'>('대시보드')

  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const [ytChannels, setYtChannels] = useState<any[]>([])
  const [ytFormOpen, setYtFormOpen] = useState(false)
  const [ytSaving, setYtSaving] = useState(false)
  const [ytEditId, setYtEditId] = useState<string | null>(null)
  const [ytForm, setYtForm] = useState({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
  const [ytSelectedChannel, setYtSelectedChannel] = useState<any | null>(null)
  const [ytVideos, setYtVideos] = useState<any[]>([])
  const [ytVideoFormOpen, setYtVideoFormOpen] = useState(false)
  const [ytVideoUrl, setYtVideoUrl] = useState('')
  const [ytVideoTitle, setYtVideoTitle] = useState('')
  const [ytVideoAdding, setYtVideoAdding] = useState(false)
  const [ytSelectedVideo, setYtSelectedVideo] = useState<any | null>(null)
  const [ytAnalysis, setYtAnalysis] = useState<any | null>(null)
  const [ytAnalyzing, setYtAnalyzing] = useState<string | null>(null)
  const [ytFetchingAll, setYtFetchingAll] = useState(false)
  const [ytFetchResult, setYtFetchResult] = useState<any>(null)
  const [ytBatchRunning, setYtBatchRunning] = useState(false)
  const [ytBatchRemaining, setYtBatchRemaining] = useState<number | null>(null)
  const [ytBatchProcessed, setYtBatchProcessed] = useState(0)
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [pushUrl, setPushUrl] = useState('')
  const [pushSending, setPushSending] = useState(false)
  const [pushResult, setPushResult] = useState<any>(null)
  const [pushHistory, setPushHistory] = useState<any[]>([])
  const [subCount, setSubCount] = useState(0)

  // 대시보드
  const [dashData, setDashData] = useState<any>(null)
  const [dashLoading, setDashLoading] = useState(false)
  const [quickPushOpen, setQuickPushOpen] = useState(false)

  const [smsAuthList, setSmsAuthList] = useState<any[]>([])
  const [resending, setResending] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<Record<string, string>>({})
  const [agentList, setAgentList] = useState<any[]>([])
  const [agentSubTab, setAgentSubTab] = useState<'전체' | '데모' | '일반'>('전체')
  const [planChanging, setPlanChanging] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    fetchData()
    fetchPushData()
  }, [])

  useEffect(() => {
    if (topMenu === '대시보드') fetchDashboardData()
    if (topMenu === '설계사') fetchAgentList()
    if (topMenu === '유튜브') fetchYtChannels()
    if (topMenu === '보험공시') fetchMeritzPdfs()
  }, [topMenu])

  async function fetchDashboardData() {
    setDashLoading(true)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 설계사 목록은 RLS 우회를 위해 admin-agents API 사용
    const { data: { session } } = await supabase.auth.getSession()
    const agentRes = session ? await fetch('/api/admin-agents', { headers: { 'Authorization': `Bearer ${session.access_token}` } }) : null
    const agentData = agentRes?.ok ? await agentRes.json() : null
    const agents = agentData?.agents || []

    const [
      { data: channels },
      { count: totalVideos },
      { count: doneVideos },
      { count: pendingVideos },
      { count: errorVideos },
      { data: pdfs },
    ] = await Promise.all([
      supabase.from('youtube_channels').select('id, name, is_active'),
      // 영상 수는 5000+ 이라 데이터 안 가져오고 count만 조회
      supabase.from('youtube_videos').select('*', { count: 'exact', head: true }),
      supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('status', 'done'),
      supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).in('status', ['pending', 'analyzing']),
      supabase.from('youtube_videos').select('*', { count: 'exact', head: true }).eq('status', 'error'),
      supabase.from('meritz_pdf_files').select('category_name, status, crawled_at').order('crawled_at', { ascending: false }),
    ])

    // 설계사
    const totalAgents = agents?.length || 0
    const newAgentsThisMonth = agents?.filter((a: any) => a.created_at >= monthAgo).length || 0
    const planBreakdown: Record<string, number> = {}
    agents?.forEach((a: any) => { const p = a.plan_type || 'basic'; planBreakdown[p] = (planBreakdown[p] || 0) + 1 })

    // YouTube (count 쿼리로 정확한 값 사용)
    const totalChannels = channels?.length || 0
    const thisWeekVideos = 0  // count 방식에선 미사용

    // 보험 PDF
    const totalPdfs = pdfs?.length || 0
    const lastCrawled = pdfs?.[0]?.crawled_at || null
    const thisWeekPdfs = pdfs?.filter(p => p.crawled_at >= weekAgo).length || 0
    const pdfErrors = pdfs?.filter(p => !['stored', 'parsed'].includes(p.status)).length || 0
    const categoryPdfs: Record<string, number> = {}
    pdfs?.forEach(p => { categoryPdfs[p.category_name] = (categoryPdfs[p.category_name] || 0) + 1 })

    setDashData({
      totalAgents, newAgentsThisMonth, planBreakdown,
      totalChannels, totalVideos: totalVideos || 0, doneVideos: doneVideos || 0, pendingVideos: pendingVideos || 0, errorVideos: errorVideos || 0, thisWeekVideos,
      totalPdfs, lastCrawled, thisWeekPdfs, pdfErrors, categoryPdfs,
    })
    setDashLoading(false)
  }

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    // 관리자 권한 체크 — admin@dpa.com만 허용
    const { data: agent } = await supabase.from('dpa_agents').select('role, email').eq('user_id', user.id).single()
    if (agent?.role !== 'admin' && agent?.email !== 'admin@dpa.com') {
      router.replace('/')
      return
    }
    setUser(user)
  }

  async function fetchData() {
    const [{ data: src }, { data: cats }, { data: vals }] = await Promise.all([
      supabase.from('dpa_insurance_sources').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('dpa_insurance_categories').select('*').order('source').order('sort_order'),
      supabase.from('dpa_insurance_validations').select('*, dpa_insurance_sources(source, category)').order('created_at', { ascending: false }).limit(50)
    ])
    setSources(src || [])
    setCategories(cats || [])
    setValidations(vals || [])
  }

  async function fetchPushData() {
    const [{ data: history }, { count }] = await Promise.all([
      supabase.from('push_notifications').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true })
    ])
    setPushHistory(history || [])
    setSubCount(count || 0)
  }

  async function fetchSmsAuthList() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin-agents', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
    if (res.ok) { const data = await res.json(); setSmsAuthList(data.smsAuthList || []) }
  }

  async function fetchMeritzPdfs() {
    const { data } = await supabase.from('meritz_pdf_files').select('*').order('crawled_at', { ascending: false })
    setMeritzPdfs(data || [])
  }

  async function startCrawl() {
    const srtSqs = CRAWL_CATEGORIES
      .filter(c => crawlSelected.includes(c.name) && c.srtSq !== null && c.srtSq > 0)
      .map(c => c.srtSq as number)
    const keywords = CRAWL_CATEGORIES
      .filter(c => crawlSelected.includes(c.name) && c.srtSq === -1)
      .map(c => c.name)
    if (srtSqs.length === 0 && keywords.length === 0) return alert('카테고리를 선택해주세요')
    setCrawling(true)
    setCrawlResults(null)
    try {
      const res = await fetch('/api/insurance-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srtSqs, keywords }),
      })
      const data = await res.json()
      setCrawlResults(data)
      fetchMeritzPdfs()
    } catch (e: any) {
      alert(`오류: ${e.message}`)
    } finally {
      setCrawling(false)
    }
  }

  async function fetchYtChannels() {
    const { data } = await supabase.from('youtube_channels').select('*').order('created_at', { ascending: false })
    setYtChannels(data || [])
  }

  async function selectYtChannel(ch: any) {
    setYtSelectedChannel(ch)
    setYtSelectedVideo(null)
    setYtAnalysis(null)
    setYtVideoFormOpen(false)
    const { data } = await supabase
      .from('youtube_videos')
      .select('*')
      .eq('channel_id', ch.id)
      .order('published_at', { ascending: false })
    setYtVideos(data || [])
  }

  async function addYtVideo() {
    if (!ytVideoUrl.trim() || !ytSelectedChannel) return
    const match = ytVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (!match) { alert('올바른 YouTube URL을 입력해주세요'); return }
    const videoId = match[1]
    setYtVideoAdding(true)
    await supabase.from('youtube_videos').insert([{
      channel_id: ytSelectedChannel.id,
      video_id: videoId,
      video_url: ytVideoUrl,
      title: ytVideoTitle || null,
      status: 'pending',
    }])
    setYtVideoUrl('')
    setYtVideoTitle('')
    setYtVideoFormOpen(false)
    setYtVideoAdding(false)
    selectYtChannel(ytSelectedChannel)
  }

  async function deleteYtVideo(id: string) {
    if (!confirm('영상을 삭제하시겠습니까?')) return
    await supabase.from('youtube_videos').delete().eq('id', id)
    selectYtChannel(ytSelectedChannel)
  }

  async function analyzeYtVideo(video: any) {
    setYtAnalyzing(video.id)
    try {
      const res = await fetch('/api/youtube-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoRowId: video.id }),
      })
      const data = await res.json()
      if (data.success) {
        selectYtChannel(ytSelectedChannel)
        fetchYtAnalysis(video.id)
      } else {
        alert(`분석 실패: ${data.error}`)
        selectYtChannel(ytSelectedChannel)
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`)
    }
    setYtAnalyzing(null)
  }

  async function fetchYtAnalysis(videoId: string) {
    const { data } = await supabase
      .from('youtube_analyses')
      .select('*')
      .eq('video_id', videoId)
      .single()
    setYtAnalysis(data || null)
  }

  async function fetchAllYtVideos(channelRowId: string) {
    setYtFetchingAll(true)
    setYtFetchResult(null)
    try {
      const res = await fetch('/api/youtube-fetch-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelRowId }),
      })
      const data = await res.json()
      setYtFetchResult(data)
      if (data.success) selectYtChannel(ytSelectedChannel)
    } catch (err: any) {
      setYtFetchResult({ error: err.message })
    }
    setYtFetchingAll(false)
  }

  async function batchAnalyzeYt(channelId?: string) {
    setYtBatchRunning(true)
    setYtBatchProcessed(0)
    setYtBatchRemaining(null)

    const run = async (): Promise<void> => {
      try {
        const res = await fetch('/api/youtube-batch-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId }),
        })
        const data = await res.json()
        setYtBatchRemaining(data.remaining ?? 0)
        setYtBatchProcessed(prev => prev + (data.processed ?? 0))
        if (!data.done) {
          await run()
        } else {
          setYtBatchRunning(false)
          if (ytSelectedChannel) selectYtChannel(ytSelectedChannel)
        }
      } catch (e: any) {
        setYtBatchRunning(false)
      }
    }
    await run()
  }

  async function selectYtVideo(v: any) {
    setYtSelectedVideo(v)
    setYtAnalysis(null)
    if (v.status === 'done') await fetchYtAnalysis(v.id)
  }

  async function saveYtChannel() {
    if (!ytForm.name.trim() || !ytForm.channel_url.trim()) { alert('채널명과 URL을 입력해주세요'); return }
    setYtSaving(true)
    if (ytEditId) {
      await supabase.from('youtube_channels').update({ ...ytForm, updated_at: new Date().toISOString() }).eq('id', ytEditId)
    } else {
      await supabase.from('youtube_channels').insert([ytForm])
    }
    setYtSaving(false)
    setYtFormOpen(false)
    setYtEditId(null)
    setYtForm({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
    fetchYtChannels()
  }

  async function deleteYtChannel(id: string) {
    if (!confirm('채널을 삭제하시겠습니까?')) return
    await supabase.from('youtube_channels').delete().eq('id', id)
    fetchYtChannels()
  }

  async function toggleYtActive(id: string, current: boolean) {
    await supabase.from('youtube_channels').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id)
    fetchYtChannels()
  }

  async function fetchAgentList() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin-agents', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
    if (res.ok) { const data = await res.json(); setAgentList(data.agents || []); setSmsAuthList(data.smsAuthList || []) }
  }

  async function changeAgentPlan(agentId: string, newPlan: string) {
    setPlanChanging(agentId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setPlanChanging(null); return }
    await supabase.from('dpa_agents').update({ plan_type: newPlan }).eq('id', agentId)
    await fetchAgentList()
    setPlanChanging(null)
  }

  async function resendSmsAuthDocs(auth: any) {
    setResending(auth.id)
    setResendResult(prev => ({ ...prev, [auth.id]: '' }))
    try {
      const res = await fetch('/api/sms-auth-resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authId: auth.id }) })
      const data = await res.json()
      setResendResult(prev => ({ ...prev, [auth.id]: data.success ? '발송 완료' : `실패: ${data.error}` }))
    } catch (err: any) {
      setResendResult(prev => ({ ...prev, [auth.id]: `오류: ${err.message}` }))
    } finally { setResending(null) }
  }

  async function sendPush() {
    if (!pushTitle.trim() || !pushBody.trim()) { alert('제목과 내용을 입력해주세요'); return }
    if (!confirm(`${subCount}명에게 공지를 발송하시겠습니까?`)) return
    setPushSending(true); setPushResult(null)
    try {
      const res = await fetch('/api/push-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: pushTitle, body: pushBody, url: pushUrl || null }) })
      const data = await res.json()
      setPushResult(data)
      if (data.success) { setPushTitle(''); setPushBody(''); setPushUrl(''); fetchPushData() }
    } catch (err: any) { setPushResult({ error: err.message }) }
    setPushSending(false)
  }

  async function uploadFile(file: File) {
    setUploading(true); setUploadResult(null)
    try {
      if (file.name.endsWith('.pdf')) {
        const fileName = `guides/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('insurance-files').upload(fileName, file, { contentType: 'application/pdf' })
        if (error) throw new Error(error.message)
        setUploadResult({ success: true, isPdf: true, fileName: file.name, filePath: fileName })
      } else {
        const formData = new FormData(); formData.append('file', file)
        const res = await fetch('/api/insurance-upload', { method: 'POST', body: formData })
        const result = await res.json(); setUploadResult(result)
        if (result.success) fetchData()
      }
    } catch (err: any) { setUploadResult({ success: false, error: err.message || '업로드 실패' })
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    for (const file of files) await uploadFile(file)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    for (const file of Array.from(e.dataTransfer.files || [])) await uploadFile(file)
  }

  function getSourceStatus(source: string, category: string) {
    return sources.find(s => s.source === source && s.category === category)
  }

  const lifeCategories = categories.filter(c => c.source === 'life')
  const damageCategories = categories.filter(c => c.source === 'damage')
  const totalUploaded = sources.length
  const totalCategories = categories.length
  const uploadRate = totalCategories > 0 ? Math.round((totalUploaded / totalCategories) * 100) : 0
  const recentValidationErrors = validations.filter(v => v.severity === 'error').length

  const TAB_ITEMS: { key: '대시보드' | '공지사항' | '설계사' | '유튜브' | '보험공시'; label: string }[] = [
    { key: '대시보드', label: '대시보드' },
    { key: '공지사항', label: '공지사항 관리' },
    { key: '설계사', label: '설계사 관리' },
    { key: '유튜브', label: 'YouTube 채널' },
    { key: '보험공시', label: '공시 관리' },
  ]

  const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '11px 16px',
    fontSize: 14,
    borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E5E7EB',
    color: isDark ? '#E8E8E8' : '#1A1A2E',
    ...extra,
  })

  const badge = (bg: string, color: string, text: string, darkBg?: string, darkColor?: string) => (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: isDark && darkBg ? darkBg : bg, color: isDark && darkColor ? darkColor : color }}>{text}</span>
  )

  const isPushDisabled = pushSending || !pushTitle.trim() || !pushBody.trim()

  return (
    <div className={styles.page}>

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>관리자 페이지</h1>
          <p className={styles.pageSub}>시스템 관리 전용 페이지입니다</p>
        </div>
        <span style={{ fontSize: 14, color: '#1A1A2E' }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* 상위 탭 */}
      <div className={styles.card} style={{ marginBottom: 20, overflow: 'visible' }}>
        <div className={styles.tabBar}>
          {TAB_ITEMS.map(({ key, label }) => (
            <button key={key} onClick={() => setTopMenu(key)}
              className={[styles.tabBtn, topMenu === key ? styles.tabActive : ''].join(' ')}>
              {label}
            </button>
          ))}
        </div>

        {/* 보험공시 서브탭 */}
        {topMenu === '보험공시' && (
          <div className={styles.subTabBar}>
            {[
              { key: 'dashboard', label: '현황 대시보드' },
              { key: 'upload', label: '파일 업로드' },
              { key: 'urls', label: 'URL 목록' },
              { key: 'crawl', label: '보험사 공시' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={[styles.subTabBtn, activeTab === tab.key ? styles.subTabActive : ''].join(' ')}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== 대시보드 ===== */}
      {topMenu === '대시보드' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dashLoading || !dashData ? (
            <div style={{ padding: 80, textAlign: 'center', color: '#8892A0', fontSize: 14 }}>대시보드 로딩 중...</div>
          ) : (
            <>
              {/* KPI 카드 6개 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: '전체 설계사', value: dashData.totalAgents, sub: `이번달 신규 +${dashData.newAgentsThisMonth}명`, color: '#5E6AD2' },
                  { label: 'YouTube 영상', value: dashData.totalVideos, sub: `채널 ${dashData.totalChannels}개`, color: '#EF4444' },
                  { label: '분석 완료', value: dashData.doneVideos, sub: `대기 ${dashData.pendingVideos}건 · 오류 ${dashData.errorVideos}건`, color: '#5E6AD2' },
                  { label: '보험 PDF', value: dashData.totalPdfs, sub: `이번주 +${dashData.thisWeekPdfs}건`, color: '#F59E0B' },
                  { label: '크롤링 오류', value: dashData.pdfErrors, sub: dashData.lastCrawled ? `최근: ${new Date(dashData.lastCrawled).toLocaleDateString('ko-KR')}` : '크롤링 없음', color: dashData.pdfErrors > 0 ? '#EF4444' : '#1A1A2E' },
                  { label: '공지 구독자', value: subCount, sub: `발송 이력 ${pushHistory.length}건`, color: '#8B5CF6' },
                ].map((card, i) => (
                  <div key={i} className={styles.card} style={{ padding: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#8892A0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{card.label}</p>
                    <p style={{ fontSize: 36, fontWeight: 700, color: card.color, margin: '0 0 4px', lineHeight: 1 }}>{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
                    <p style={{ fontSize: 12, color: '#636B78', margin: 0 }}>{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* 2열 — 공지사항 + 설계사 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* 공지사항 */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>공지사항</p>
                    <button className={styles.primaryBtn} onClick={() => setQuickPushOpen(v => !v)}>+ 공지 보내기</button>
                  </div>

                  {quickPushOpen && (
                    <div style={{ padding: '0 20px 16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E5E7EB' }}>
                      <input className={styles.fieldInput} value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="공지 제목" style={{ marginBottom: 8 }} />
                      <textarea className={styles.fieldTextarea} value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="공지 내용" rows={3} style={{ marginBottom: 8 }} />
                      <input className={styles.fieldInput} value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="클릭 시 이동 URL (선택)" style={{ marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className={[styles.sendBtn, !isPushDisabled ? styles.sendBtnActive : styles.sendBtnDisabled].join(' ')}
                          disabled={isPushDisabled}
                          onClick={async () => { await sendPush(); setQuickPushOpen(false) }}
                        >
                          {pushSending ? '발송 중...' : `${subCount}명에게 발송`}
                        </button>
                        <button onClick={() => setQuickPushOpen(false)} style={{ fontSize: 13, color: '#636B78', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
                      </div>
                    </div>
                  )}

                  {pushHistory.length === 0 ? (
                    <p style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>발송된 공지가 없습니다</p>
                  ) : (
                    <div>
                      {pushHistory.slice(0, 5).map(n => (
                        <div key={n.id} style={{ padding: '10px 20px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E', margin: 0 }}>{n.title}</p>
                            <p style={{ fontSize: 11, color: '#8892A0', margin: '2px 0 0' }}>
                              {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span style={{ fontSize: 11, color: '#636B78', whiteSpace: 'nowrap' }}>{n.sent_count}명</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 설계사 현황 */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>설계사 현황</p>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20 }}>
                      {[
                        { label: '전체', value: dashData.totalAgents, color: '#1A1A2E' },
                        { label: '이번달 신규', value: `+${dashData.newAgentsThisMonth}`, color: '#5E6AD2' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 32, fontWeight: 700, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                          <p style={{ fontSize: 11, color: '#8892A0', margin: '4px 0 0' }}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: 11, fontWeight: 600, color: '#8892A0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>플랜별 분포</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={Object.entries(dashData.planBreakdown).map(([name, value]) => ({ name: name.toUpperCase(), value }))}
                          cx="50%" cy="50%"
                          innerRadius={38} outerRadius={58}
                          dataKey="value"
                          label={({ name, value }) => `${name} ${value}명`}
                          labelLine={false}
                        >
                          {Object.keys(dashData.planBreakdown).map((_: string, idx: number) => (
                            <Cell key={idx} fill={['#5E6AD2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 5]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [`${v}명`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                      {Object.entries(dashData.planBreakdown).map(([plan, cnt]: [string, any], idx: number) => (
                        <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ['#5E6AD2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][idx % 5], display: 'inline-block' }} />
                          <span style={{ color: '#636B78' }}>{plan.toUpperCase()} {cnt}명</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2열 — YouTube + 보험공시 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* YouTube */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>YouTube 현황</p>
                    <span style={{ fontSize: 12, color: '#8892A0' }}>이번주 신규 {dashData.thisWeekVideos}건</span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                      {[
                        { label: '채널', value: dashData.totalChannels },
                        { label: '전체 영상', value: dashData.totalVideos },
                        { label: '분석 완료', value: dashData.doneVideos },
                        { label: '분석 대기', value: dashData.pendingVideos },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 14px' }}>
                          <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>{s.label}</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: 11, fontWeight: 600, color: '#8892A0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>분석 현황</p>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart
                        layout="vertical"
                        data={[
                          { name: '완료', value: dashData.doneVideos },
                          { name: '대기', value: dashData.pendingVideos },
                          { name: '오류', value: dashData.errorVideos },
                        ]}
                        margin={{ left: 32, right: 24, top: 0, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#636B78' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => [`${v}건`]} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {[{ fill: '#10B981' }, { fill: '#F59E0B' }, { fill: '#EF4444' }].map((e, i) => (
                            <Cell key={i} fill={e.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 보험 공시 */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>보험 공시 현황</p>
                    {dashData.lastCrawled && (
                      <span style={{ fontSize: 11, color: '#8892A0' }}>
                        최근: {new Date(dashData.lastCrawled).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                      {[
                        { label: '전체 PDF', value: `${dashData.totalPdfs}건`, color: '#1A1A2E' },
                        { label: '이번주 업데이트', value: `+${dashData.thisWeekPdfs}`, color: '#5E6AD2' },
                        { label: '오류', value: `${dashData.pdfErrors}`, color: '#EF4444' },
                      ].map(s => (
                        <div key={s.label}>
                          <p style={{ fontSize: 11, color: '#8892A0', margin: '0 0 2px' }}>{s.label}</p>
                          <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: 11, fontWeight: 600, color: '#8892A0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>카테고리별 PDF 수</p>
                    {Object.keys(dashData.categoryPdfs).length === 0 ? (
                      <p style={{ fontSize: 13, color: '#8892A0', padding: '20px 0', textAlign: 'center' }}>저장된 PDF 없음</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.min(Object.keys(dashData.categoryPdfs).length * 30 + 10, 200)}>
                        <BarChart
                          layout="vertical"
                          data={Object.entries(dashData.categoryPdfs).map(([name, value]) => ({ name, value }))}
                          margin={{ left: 60, right: 24, top: 0, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#636B78' }} axisLine={false} tickLine={false} width={60} />
                          <Tooltip formatter={(v: any) => [`${v}건`]} />
                          <Bar dataKey="value" fill="#5E6AD2" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* 빠른 액션 */}
              <div className={styles.card} style={{ padding: 20 }}>
                <p className={styles.cardTitle} style={{ marginBottom: 12 }}>빠른 액션</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className={styles.primaryBtn} onClick={() => { setTopMenu('공지사항'); setQuickPushOpen(true) }}>공지 보내기</button>
                  <button className={styles.primaryBtn} onClick={() => { setTopMenu('보험공시'); setActiveTab('crawl') }}>크롤링 실행</button>
                  <button className={styles.primaryBtn} onClick={() => setTopMenu('유튜브')}>YouTube 관리</button>
                  <button className={styles.refreshBtn} onClick={fetchDashboardData}>새로고침</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== 공지사항 관리 ===== */}
      {topMenu === '공지사항' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 푸시 발송 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitle}>푸시 알림 발송</p>
                <p className={styles.cardSub}>
                  현재 구독자 <span className={styles.cardAccent}>{subCount}명</span>
                </p>
              </div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className={styles.fieldLabel}>제목</label>
                <input className={styles.fieldInput} value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="공지사항 제목을 입력하세요" />
              </div>
              <div>
                <label className={styles.fieldLabel}>내용</label>
                <textarea className={styles.fieldTextarea} value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="공지사항 내용을 입력하세요" rows={4} />
              </div>
              <div>
                <label className={styles.fieldLabel}>클릭 시 이동 URL</label>
                <input className={styles.fieldInput} value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="예: /notifications (선택사항)" />
              </div>
              <button onClick={sendPush} disabled={isPushDisabled}
                className={[styles.sendBtn, isPushDisabled ? styles.sendBtnDisabled : styles.sendBtnActive].join(' ')}>
                {pushSending ? '발송 중...' : `${subCount}명에게 푸시 발송`}
              </button>
              {pushResult && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: pushResult.success ? '#D1FAE5' : '#FEE2E2', color: pushResult.success ? '#065F46' : '#991B1B', fontSize: 13 }}>
                  {pushResult.success ? `발송 완료 · ${pushResult.sent}/${pushResult.total}명 성공` : `발송 실패: ${pushResult.error}`}
                </div>
              )}
            </div>
          </div>

          {/* 발송 이력 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>발송 이력</p>
            </div>
            {pushHistory.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>아직 발송 이력이 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['발송일', '제목', '내용', '발송 수'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {pushHistory.map(n => (
                    <tr key={n.id}>
                      <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                        {new Date(n.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle({ fontWeight: 500 })}>{n.title}</td>
                      <td style={tdStyle({ color: '#636B78', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{n.body}</td>
                      <td style={tdStyle()}>{badge('#EEF2FF', '#5E6AD2', `${n.sent_count}명`, 'rgba(94,106,210,0.2)', '#A5B0FF')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== 설계사 관리 ===== */}
      {topMenu === '설계사' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 설계사 목록 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <p className={styles.cardTitle}>설계사 목록</p>
                {/* 서브탭 */}
                {(['전체', '데모', '일반'] as const).map(tab => {
                  const count = tab === '전체' ? agentList.length : tab === '데모' ? agentList.filter(a => a.plan_type === 'demo').length : agentList.filter(a => a.plan_type !== 'demo').length
                  return (
                    <button key={tab} onClick={() => setAgentSubTab(tab)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid',
                      borderColor: agentSubTab === tab ? '#5E6AD2' : (isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'),
                      background: agentSubTab === tab ? '#EEF2FF' : 'transparent',
                      color: agentSubTab === tab ? '#5E6AD2' : (isDark ? '#9CA3AF' : '#636B78'),
                      fontSize: 12, fontWeight: agentSubTab === tab ? 700 : 500, cursor: 'pointer',
                    }}>
                      {tab} <span style={{ opacity: 0.7 }}>{count}</span>
                    </button>
                  )
                })}
              </div>
              <button className={styles.refreshBtn} onClick={fetchAgentList}>새로고침</button>
            </div>
            {(() => {
              const filtered = agentSubTab === '전체' ? agentList : agentSubTab === '데모' ? agentList.filter(a => a.plan_type === 'demo') : agentList.filter(a => a.plan_type !== 'demo')
              const showDemoCol = agentSubTab !== '일반'
              const showPlanChangeCol = agentSubTab === '데모'
              if (filtered.length === 0) return <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>해당하는 설계사가 없습니다</p>
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['이름', '연락처', '요금제', '상태', '가입일', ...(showDemoCol ? ['데모 만료'] : []), ...(showPlanChangeCol ? ['전환'] : [])].map(h => <th key={h} className={styles.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filtered.map(agent => {
                      const demoExpires = agent.demo_expires_at ? new Date(agent.demo_expires_at) : null
                      const dDay = demoExpires ? Math.ceil((demoExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                      return (
                        <tr key={agent.id}>
                          <td style={tdStyle({ fontWeight: 600 })}>
                            <div>{agent.name}</div>
                            <div style={{ fontSize: 11, color: isDark ? '#9CA3AF' : '#8892A0' }}>{agent.email}</div>
                          </td>
                          <td style={tdStyle()}>{agent.phone}</td>
                          <td style={tdStyle()}>
                            {badge(
                              agent.plan_type === 'pro' ? '#5E6AD2' : agent.plan_type === 'standard' ? '#3B82F6' : agent.plan_type === 'demo' ? '#F59E0B' : '#9CA3AF',
                              '#fff',
                              agent.plan_type?.toUpperCase() || 'BASIC'
                            )}
                          </td>
                          <td style={tdStyle()}>
                            {badge(
                              agent.status === 'approved' ? '#EEF2FF' : agent.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                              agent.status === 'approved' ? '#5E6AD2' : agent.status === 'pending' ? '#92400E' : '#991B1B',
                              agent.status === 'approved' ? '승인' : agent.status === 'pending' ? '대기' : '반려',
                              agent.status === 'approved' ? 'rgba(94,106,210,0.2)' : agent.status === 'pending' ? 'rgba(180,83,9,0.18)' : 'rgba(220,38,38,0.15)',
                              agent.status === 'approved' ? '#A5B0FF' : agent.status === 'pending' ? '#FCD34D' : '#F87171'
                            )}
                          </td>
                          <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                            {new Date(agent.created_at).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' })}
                          </td>
                          {showDemoCol && (
                            <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                              {dDay !== null ? (
                                <span style={{ fontSize: 12, fontWeight: 600, color: dDay <= 0 ? '#EF4444' : dDay <= 2 ? '#F59E0B' : (isDark ? '#A5B0FF' : '#5E6AD2') }}>
                                  {dDay <= 0 ? '만료됨' : `D-${dDay}`}
                                </span>
                              ) : <span style={{ color: '#8892A0', fontSize: 12 }}>-</span>}
                            </td>
                          )}
                          {showPlanChangeCol && (
                            <td style={tdStyle()}>
                              <select
                                disabled={planChanging === agent.id}
                                defaultValue=""
                                onChange={e => { if (e.target.value) changeAgentPlan(agent.id, e.target.value) }}
                                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`, background: isDark ? '#2A2A2A' : '#F9FAFB', color: isDark ? '#E8E8E8' : '#1A1A2E', cursor: 'pointer' }}>
                                <option value="" disabled>{planChanging === agent.id ? '처리 중...' : '요금제 전환'}</option>
                                <option value="basic">베이직</option>
                                <option value="standard">스탠다드</option>
                                <option value="pro">프로</option>
                              </select>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>

          {/* 발신번호 신청 목록 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>발신번호 등록 신청 목록</p>
              <button className={styles.refreshBtn} onClick={fetchSmsAuthList}>새로고침</button>
            </div>
            {smsAuthList.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', fontSize: 14, color: '#8892A0' }}>신청 내역이 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['신청일', '이름', '발신번호', '생년월일', '상태', '서류 재발송'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {smsAuthList.map(auth => (
                    <tr key={auth.id}>
                      <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap' })}>
                        {new Date(auth.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={tdStyle({ fontWeight: 600 })}>{auth.agent_name}</td>
                      <td style={tdStyle()}>{auth.sender_phone}</td>
                      <td style={tdStyle({ color: '#636B78' })}>{auth.birth_date}</td>
                      <td style={tdStyle()}>
                        {badge(
                          auth.status === 'approved' ? '#D1FAE5' : auth.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                          auth.status === 'approved' ? '#065F46' : auth.status === 'pending' ? '#92400E' : '#991B1B',
                          auth.status === 'approved' ? '승인완료' : auth.status === 'pending' ? '검토중' : '반려'
                        )}
                      </td>
                      <td style={tdStyle()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className={styles.primaryBtn} onClick={() => resendSmsAuthDocs(auth)}
                            disabled={resending === auth.id}
                            style={{ opacity: resending === auth.id ? 0.6 : 1 }}>
                            {resending === auth.id ? '발송 중...' : '서류 재발송'}
                          </button>
                          {resendResult[auth.id] && (
                            <span style={{ fontSize: 12, color: resendResult[auth.id].startsWith('발송') ? '#065F46' : '#991B1B' }}>{resendResult[auth.id]}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== YouTube 채널 관리 ===== */}
      {topMenu === '유튜브' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 210px)', minHeight: 500 }}>

          {/* ── 왼쪽: 채널 목록 ── */}
          <div className={styles.card} style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>채널 목록</p>
              <button className={styles.primaryBtn} onClick={() => {
                setYtEditId(null)
                setYtForm({ name: '', handle: '', channel_url: '', summary: '', subscriber_count: '' })
                setYtFormOpen(true)
              }}>+ 추가</button>
            </div>

            {/* 채널 추가/편집 폼 */}
            {ytFormOpen && (
              <div style={{ padding: 14, borderBottom: '1px solid #E5E7EB', background: '#F7F8FA', flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: '0 0 10px' }}>
                  {ytEditId ? '채널 편집' : '채널 추가'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label className={styles.fieldLabel}>채널명 *</label>
                    <input className={styles.fieldInput} placeholder="보험명의 정닥터" value={ytForm.name}
                      onChange={e => setYtForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>핸들</label>
                    <input className={styles.fieldInput} placeholder="@보험명의정닥터" value={ytForm.handle}
                      onChange={e => setYtForm(p => ({ ...p, handle: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>채널 URL *</label>
                    <input className={styles.fieldInput} placeholder="https://www.youtube.com/@..." value={ytForm.channel_url}
                      onChange={e => setYtForm(p => ({ ...p, channel_url: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>구독자 수</label>
                    <input className={styles.fieldInput} placeholder="11만명" value={ytForm.subscriber_count}
                      onChange={e => setYtForm(p => ({ ...p, subscriber_count: e.target.value }))} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel}>요약</label>
                    <textarea className={styles.fieldTextarea} rows={2}
                      placeholder="채널 특징, 전환율이 높은 이유 등 메모"
                      value={ytForm.summary}
                      onChange={e => setYtForm(p => ({ ...p, summary: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.refreshBtn} onClick={() => { setYtFormOpen(false); setYtEditId(null) }}>취소</button>
                    <button className={styles.primaryBtn} style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={saveYtChannel} disabled={ytSaving}>
                      {ytSaving ? '저장 중...' : ytEditId ? '수정' : '추가'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 채널 리스트 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {ytChannels.length === 0 ? (
                <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>채널을 추가해보세요</p>
              ) : ytChannels.map(ch => (
                <div key={ch.id}
                  onClick={() => selectYtChannel(ch)}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #E5E7EB',
                    borderLeft: `3px solid ${ytSelectedChannel?.id === ch.id ? '#5E6AD2' : 'transparent'}`,
                    background: ytSelectedChannel?.id === ch.id ? '#F0F0FD' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (ytSelectedChannel?.id !== ch.id) e.currentTarget.style.background = '#F7F8FA' }}
                  onMouseLeave={e => { if (ytSelectedChannel?.id !== ch.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ytSelectedChannel?.id === ch.id ? '#5E6AD2' : '#1A1A2E' }}>
                      {ch.name}
                    </span>
                    {ch.is_active
                      ? badge('#EEF2FF', '#5E6AD2', '활성', 'rgba(94,106,210,0.2)', '#A5B0FF')
                      : badge('#F3F4F6', '#6B7280', '비활성', 'rgba(255,255,255,0.07)', '#888')
                    }
                  </div>
                  <div style={{ fontSize: 11, color: '#8892A0' }}>
                    {ch.handle && <span>{ch.handle}</span>}
                    {ch.subscriber_count && <span> · {ch.subscriber_count}</span>}
                  </div>
                  {ch.summary && (
                    <div style={{ fontSize: 11, color: '#8892A0', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.summary}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                    <button className={styles.refreshBtn} style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        setYtEditId(ch.id)
                        setYtForm({ name: ch.name, handle: ch.handle || '', channel_url: ch.channel_url, summary: ch.summary || '', subscriber_count: ch.subscriber_count || '' })
                        setYtFormOpen(true)
                      }}>편집</button>
                    <button className={styles.refreshBtn} style={{ fontSize: 11, padding: '2px 8px', color: '#991B1B' }}
                      onClick={() => deleteYtChannel(ch.id)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 영상 목록 + 분석 결과 ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', minWidth: 0 }}>
            {!ytSelectedChannel ? (
              <div className={styles.card} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 14, color: '#8892A0', textAlign: 'center', lineHeight: 1.8 }}>
                  왼쪽에서 채널을 선택하세요
                </p>
              </div>
            ) : (
              <>
                {/* 영상 목록 카드 */}
                <div className={styles.card} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p className={styles.cardTitle}>{ytSelectedChannel.name}</p>
                      <span style={{ fontSize: 13, color: '#8892A0' }}>영상 {ytVideos.length}개</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {ytFetchResult && (
                        <span style={{ fontSize: 12, color: ytFetchResult.error ? '#991B1B' : '#065F46' }}>
                          {ytFetchResult.error
                            ? `오류: ${ytFetchResult.error}`
                            : `신규 ${ytFetchResult.newCount}개 추가 (전체 ${ytFetchResult.totalFetched}개 확인)`}
                        </span>
                      )}
                      <a href={ytSelectedChannel.channel_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#5E6AD2', textDecoration: 'none', padding: '5px 10px', border: '1px solid #5E6AD2', borderRadius: 6 }}>
                        채널 열기
                      </a>
                      <button className={styles.refreshBtn}
                        disabled={ytFetchingAll}
                        style={{ opacity: ytFetchingAll ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        onClick={() => fetchAllYtVideos(ytSelectedChannel.id)}>
                        {ytFetchingAll ? '수집 중...' : '전체 영상 가져오기'}
                      </button>
                      <button
                        disabled={ytBatchRunning}
                        onClick={() => batchAnalyzeYt(ytSelectedChannel.id)}
                        style={{
                          fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: ytBatchRunning ? '#E5E7EB' : '#1A1A2E',
                          color: ytBatchRunning ? '#8892A0' : 'white',
                          cursor: ytBatchRunning ? 'not-allowed' : 'pointer',
                          fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                        {ytBatchRunning
                          ? `분석 중... (남은 ${ytBatchRemaining ?? '?'}개 / 완료 ${ytBatchProcessed}개)`
                          : '미분석 일괄 분석'}
                      </button>
                      <button className={styles.primaryBtn} onClick={() => setYtVideoFormOpen(v => !v)}>
                        + 영상 추가
                      </button>
                    </div>
                  </div>

                  {/* 영상 추가 폼 */}
                  {ytVideoFormOpen && (
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', background: '#F7F8FA', flexShrink: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label className={styles.fieldLabel}>YouTube URL *</label>
                          <input className={styles.fieldInput} placeholder="https://www.youtube.com/watch?v=..."
                            value={ytVideoUrl} onChange={e => setYtVideoUrl(e.target.value)} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>영상 제목 (선택)</label>
                          <input className={styles.fieldInput} placeholder="제목 직접 입력"
                            value={ytVideoTitle} onChange={e => setYtVideoTitle(e.target.value)} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className={styles.refreshBtn} onClick={() => setYtVideoFormOpen(false)}>취소</button>
                        <button className={styles.primaryBtn} style={{ padding: '7px 20px', fontSize: 13 }}
                          onClick={addYtVideo} disabled={ytVideoAdding}>
                          {ytVideoAdding ? '추가 중...' : '영상 추가'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 영상 테이블 */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {ytVideos.length === 0 ? (
                      <p style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>
                        영상을 추가해보세요
                      </p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          {['영상', '상태', '등록일', '분석'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {ytVideos.map(v => (
                            <tr key={v.id}
                              onClick={() => selectYtVideo(v)}
                              style={{ cursor: 'pointer', background: ytSelectedVideo?.id === v.id ? '#F0F0FD' : 'transparent' }}
                              onMouseEnter={e => { if (ytSelectedVideo?.id !== v.id) e.currentTarget.style.background = '#F7F8FA' }}
                              onMouseLeave={e => { if (ytSelectedVideo?.id !== v.id) e.currentTarget.style.background = 'transparent' }}
                            >
                              <td style={tdStyle({ maxWidth: 300 })}>
                                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v.title || `영상 (${v.video_id})`}
                                </div>
                                <a href={v.video_url} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: 11, color: '#5E6AD2', textDecoration: 'none' }}>
                                  youtu.be/{v.video_id}
                                </a>
                              </td>
                              <td style={tdStyle({ whiteSpace: 'nowrap' })}>
                                {v.status === 'done' && badge('#D1FAE5', '#065F46', '분석완료')}
                                {v.status === 'pending' && badge('#F3F4F6', '#6B7280', '미분석')}
                                {v.status === 'analyzing' && badge('#EFF6FF', '#1D4ED8', '분석중...')}
                                {v.status === 'error' && badge('#FEE2E2', '#991B1B', '오류')}
                              </td>
                              <td style={tdStyle({ color: '#636B78', whiteSpace: 'nowrap', fontSize: 12 })}>
                                {v.published_at || '-'}
                              </td>
                              <td style={tdStyle()} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <button className={styles.primaryBtn}
                                    style={{ fontSize: 12, padding: '4px 12px', opacity: ytAnalyzing === v.id ? 0.6 : 1 }}
                                    disabled={ytAnalyzing === v.id || v.status === 'analyzing'}
                                    onClick={() => analyzeYtVideo(v)}>
                                    {ytAnalyzing === v.id ? '분석중...' : v.status === 'done' ? '재분석' : '분석하기'}
                                  </button>
                                  <button className={styles.refreshBtn} style={{ fontSize: 12, color: '#991B1B' }}
                                    onClick={() => deleteYtVideo(v.id)}>삭제</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* 분석 결과 카드 */}
                {ytSelectedVideo && (
                  <div className={styles.card} style={{ flexShrink: 0, maxHeight: 320, overflowY: 'auto' }}>
                    <div className={styles.cardHeader} style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <p className={styles.cardTitle}>
                        분석 결과 — {ytSelectedVideo.title || ytSelectedVideo.video_id}
                      </p>
                      {ytSelectedVideo.status === 'error' && (
                        <span style={{ fontSize: 12, color: '#991B1B' }}>{ytSelectedVideo.error_message}</span>
                      )}
                    </div>
                    {!ytAnalysis ? (
                      <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>
                        {ytSelectedVideo.status === 'pending' ? '분석하기 버튼을 눌러주세요' :
                          ytSelectedVideo.status === 'error' ? '분석 중 오류가 발생했습니다. 재분석해보세요.' :
                            '분석 결과를 불러오는 중...'}
                      </p>
                    ) : (
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* 요약 */}
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>요약</p>
                          <p style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.7, margin: 0 }}>{ytAnalysis.summary}</p>
                        </div>
                        {/* 핵심 포인트 */}
                        {ytAnalysis.key_points?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>핵심 포인트</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.key_points.map((p: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 피칭 포인트 */}
                        {ytAnalysis.pitch_points?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>피칭 포인트</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.pitch_points.map((p: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 화법 */}
                        {ytAnalysis.scripts?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>화법 예시</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ytAnalysis.scripts.map((s: string, i: number) => (
                                <div key={i} style={{ background: '#F0F0FD', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #5E6AD2', fontSize: 13, color: '#3D47B5', lineHeight: 1.6 }}>
                                  {s}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 비교 기준 */}
                        {ytAnalysis.comparison_criteria?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#5E6AD2', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>비교 기준</p>
                            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {ytAnalysis.comparison_criteria.map((c: string, i: number) => (
                                <li key={i} style={{ fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: '#8892A0', margin: 0 }}>
                          분석일: {new Date(ytAnalysis.analyzed_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 보험 공시 관리 ===== */}
      {topMenu === '보험공시' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 현황 대시보드 */}
          {activeTab === 'dashboard' && (<>
            <div className={styles.statGrid}>
              {[
                { label: '전체 카테고리', value: totalCategories },
                { label: '업로드 완료', value: totalUploaded },
                { label: '업로드율', value: `${uploadRate}%` },
                { label: '검증 오류', value: recentValidationErrors },
              ].map((card, i) => (
                <div key={i} className={styles.statCard}>
                  <p className={styles.statLabel}>{card.label}</p>
                  <p className={styles.statValue}>{card.value}</p>
                </div>
              ))}
            </div>

            {[
              { src: 'life', title: '생명보험협회 공시', url: 'pub.insure.or.kr', cats: lifeCategories },
              { src: 'damage', title: '손해보험협회 공시', url: 'pub.knia.or.kr', cats: damageCategories },
            ].map(({ src, title, url, cats }) => (
              <div key={src} className={styles.card}>
                <div className={styles.cardHeader}>
                  <p className={styles.cardTitle}>{title}</p>
                  <span style={{ fontSize: 12, color: '#8892A0' }}>{url}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['카테고리', '우선순위', '업로드일', '보험사 수', '행 수', '상태'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {cats.map(cat => {
                      const uploaded = getSourceStatus(src, cat.category)
                      return (
                        <tr key={cat.id}>
                          <td style={tdStyle({ fontWeight: 500 })}>{cat.category}</td>
                          <td style={tdStyle()}>
                            {cat.is_priority ? badge('#FEF3C7', '#D97706', '핵심', 'rgba(180,83,9,0.18)', '#FCD34D') : <span style={{ color: '#8892A0', fontSize: 14 }}>-</span>}
                          </td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? new Date(uploaded.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? `${uploaded.company_count}개` : '-'}</td>
                          <td style={tdStyle({ color: '#636B78' })}>{uploaded ? `${uploaded.row_count.toLocaleString()}행` : '-'}</td>
                          <td style={tdStyle()}>
                            {uploaded
                              ? badge('#EEF2FF', '#5E6AD2', '완료', 'rgba(94,106,210,0.2)', '#A5B0FF')
                              : badge('#FEE2E2', '#991B1B', '미업로드', 'rgba(220,38,38,0.15)', '#F87171')
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {validations.length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <p className={styles.cardTitle}>최근 검증 로그</p>
                </div>
                <div style={{ padding: 16 }}>
                  {validations.slice(0, 10).map(v => (
                    <div key={v.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E5E7EB', alignItems: 'flex-start' }}>
                      {v.severity === 'error'
                        ? badge('#FEE2E2', '#991B1B', '오류', 'rgba(220,38,38,0.15)', '#F87171')
                        : badge('#FEF3C7', '#D97706', '경고', 'rgba(180,83,9,0.18)', '#FCD34D')
                      }
                      <div>
                        <p style={{ fontSize: 14, color: '#1A1A2E' }}>{v.detail}</p>
                        <p style={{ fontSize: 13, color: '#8892A0', marginTop: 2 }}>
                          {v.dpa_insurance_sources?.source === 'life' ? '생명보험' : '손해보험'} {v.dpa_insurance_sources?.category} · {v.check_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* 파일 업로드 */}
          {activeTab === 'upload' && (
            <div className={styles.card} style={{ padding: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>보험 공시 파일 업로드</h2>
              <p style={{ fontSize: 13, color: '#636B78', margin: '0 0 24px' }}>파일을 업로드하면 자동으로 생명/손해보험, 카테고리를 판별해서 저장합니다.</p>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={[styles.uploadArea, dragOver ? styles.uploadAreaActive : ''].join(' ')}
              >
                <p className={styles.uploadTitle}>{dragOver ? '파일을 놓으세요!' : '클릭 또는 드래그로 파일 선택'}</p>
                <p className={styles.uploadSub}>공시 엑셀(.xls) 또는 보험사 요약서(.pdf)</p>
                <input ref={fileRef} type="file" accept=".xls,.xlsx,.pdf" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>

              {uploading && (
                <div style={{ marginTop: 20, padding: 20, background: 'rgba(94,106,210,0.06)', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>파일 분석 중...</p>
                  <p style={{ fontSize: 13, color: '#636B78', marginTop: 4 }}>자동으로 보험 종류와 카테고리를 판별하고 있어요</p>
                </div>
              )}

              {uploadResult && (
                <div style={{ marginTop: 20, padding: 20, background: uploadResult.success ? '#F0FDF9' : '#FEF2F2', borderRadius: 10 }}>
                  {uploadResult.success ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#065F46', marginBottom: 12 }}>{uploadResult.isPdf ? 'PDF 업로드 완료' : '업로드 완료'}</p>
                      {!uploadResult.isPdf && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                          <div><span style={{ color: '#636B78' }}>판별 결과:</span> <strong>{uploadResult.source === 'life' ? '생명보험협회' : '손해보험협회'} {uploadResult.category}</strong></div>
                          <div><span style={{ color: '#636B78' }}>보험사 수:</span> <strong>{uploadResult.companyCount}개</strong></div>
                          <div><span style={{ color: '#636B78' }}>총 행 수:</span> <strong>{uploadResult.rowCount?.toLocaleString()}행</strong></div>
                          <div><span style={{ color: '#636B78' }}>검증 경고:</span> <strong>{uploadResult.warnings}건</strong></div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>업로드 실패</p>
                      <p style={{ fontSize: 13, color: '#636B78' }}>{uploadResult.error}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* URL 목록 */}
          {activeTab === 'urls' && (
            <>
              {['life', 'damage'].map(src => (
                <div key={src} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>
                      {src === 'life' ? '생명보험협회 공시 URL' : '손해보험협회 공시 URL'}
                    </p>
                  </div>
                  <div style={{ padding: 16 }}>
                    {categories.filter(c => c.source === src).map(cat => (
                      <div key={cat.id} className={styles.urlRow}>
                        <div className={styles.urlName}>
                          {cat.category}
                          {cat.is_priority && <span className={styles.priorityChip}>핵심</span>}
                        </div>
                        <div className={styles.urlValue}>{cat.site_url}</div>
                        <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(cat.site_url); alert('URL 복사됨!') }}>
                          복사
                        </button>
                        <a href={cat.site_url} target="_blank" rel="noreferrer" className={styles.openLink}>
                          열기
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 보험사 공시 */}
          {activeTab === 'crawl' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 보험사 × 카테고리 연동 현황 표 */}
              {(() => {
                const ACTIVE_CATS = [
                  { name: '암보험', confirmed: true },
                  { name: '질병보험', confirmed: true },
                  { name: '생활보험+반려동물', confirmed: true },
                  { name: '어린이보험', confirmed: true },
                  { name: '운전자보험', confirmed: true },
                  { name: '상해보험', confirmed: true },
                  { name: '통합(실손)', confirmed: true },
                  { name: '자동차', confirmed: true },
                  { name: '연금저축', confirmed: true },
                  { name: '배상책임', confirmed: true },
                  { name: '화재보험', confirmed: true },
                  { name: '치아보험', confirmed: true },
                  { name: '사망보험', confirmed: true },
                  { name: '태아보험', confirmed: true },
                ]
                const thS: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#8892A0', background: isDark ? '#2A2A2A' : '#F7F8FA', borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #E5E7EB', textAlign: 'center', whiteSpace: 'nowrap' }
                const tdS: React.CSSProperties = { padding: '7px 8px', fontSize: 12, borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F3F4F6', textAlign: 'center' }
                return (
                  <div className={styles.card} style={{ overflowX: 'auto' }}>
                    <div className={styles.cardHeader}>
                      <p className={styles.cardTitle}>보험사 × 카테고리 연동 현황</p>
                      <span style={{ fontSize: 12, color: '#8892A0' }}>✓ API 연동 · — 준비중 · ? srtSq 미확인</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ ...thS, textAlign: 'left', width: 110 }}>보험사</th>
                            <th style={{ ...thS, width: 44 }}>구분</th>
                            {ACTIVE_CATS.map(c => (
                              <th key={c.name} style={{ ...thS, color: c.confirmed ? '#8892A0' : '#C0C8D0' }}>{c.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {INSURERS.map((ins, idx) => (
                            <tr key={ins.id} style={{ background: idx % 2 === 0 ? (isDark ? '#1E1E1E' : '#fff') : (isDark ? '#242424' : '#FAFAFA') }}>
                              <td style={{ ...tdS, textAlign: 'left', fontWeight: ins.active ? 600 : 400, color: ins.active ? (isDark ? '#E8E8E8' : '#1A1A2E') : '#8892A0', paddingLeft: 16 }}>
                                {ins.name}
                              </td>
                              <td style={tdS}>
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: ins.type === '손해보험' ? (isDark ? 'rgba(29,78,216,0.2)' : '#EFF6FF') : (isDark ? 'rgba(180,83,9,0.18)' : '#FEF3C7'), color: ins.type === '손해보험' ? (isDark ? '#93C5FD' : '#1D4ED8') : (isDark ? '#FCD34D' : '#B45309') }}>
                                  {ins.type === '손해보험' ? '손해' : '생명'}
                                </span>
                              </td>
                              {ACTIVE_CATS.map(c => (
                                <td key={c.name} style={tdS}>
                                  {ins.active && c.confirmed
                                    ? <span style={{ color: isDark ? '#A5B0FF' : '#5E6AD2', fontWeight: 700, fontSize: 14 }}>✓</span>
                                    : ins.active && !c.confirmed
                                    ? <span style={{ color: '#F59E0B', fontSize: 13 }}>?</span>
                                    : <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB' }}>—</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '8px 16px', borderTop: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #F3F4F6', display: 'flex', gap: 16, fontSize: 11, color: '#8892A0' }}>
                      <span><span style={{ color: isDark ? '#A5B0FF' : '#5E6AD2', fontWeight: 700 }}>✓</span> API 연동 완료</span>
                      <span><span style={{ color: '#F59E0B' }}>?</span> srtSq 미확인 (DevTools로 탐색 필요)</span>
                      <span><span style={{ color: isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB' }}>—</span> 미연동</span>
                    </div>
                  </div>
                )
              })()}

              {/* 보험사 카드 목록 */}
              <div className={styles.card} style={{ padding: 20 }}>
                <p className={styles.cardTitle} style={{ marginBottom: 14 }}>보험사 선택</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {INSURERS.map(ins => (
                    <button
                      key={ins.id}
                      onClick={() => ins.active && setSelectedInsurer(ins.id === selectedInsurer ? null : ins.id)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: selectedInsurer === ins.id ? '2px solid #5E6AD2' : isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #E5E7EB',
                        background: selectedInsurer === ins.id ? (isDark ? 'rgba(94,106,210,0.2)' : '#F0F0FD') : ins.active ? (isDark ? '#2A2A2A' : '#fff') : (isDark ? '#222' : '#F7F8FA'),
                        color: selectedInsurer === ins.id ? '#5E6AD2' : ins.active ? (isDark ? '#E8E8E8' : '#1A1A2E') : '#8892A0',
                        cursor: ins.active ? 'pointer' : 'not-allowed',
                        position: 'relative',
                      }}
                    >
                      {ins.name}
                      {!ins.active && <span style={{ fontSize: 10, marginLeft: 4, color: '#C0C8D0' }}>준비중</span>}
                      <span style={{ fontSize: 10, color: '#8892A0', marginLeft: 4 }}>({ins.type.slice(0, 2)})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 선택된 보험사: 메리츠 */}
              {selectedInsurer === 'meritz' && (<>

                {/* 카테고리 선택 + 다운로드 */}
                <div className={styles.card} style={{ padding: 24 }}>
                  <p className={styles.cardTitle} style={{ marginBottom: 12 }}>카테고리별 요약서 다운로드</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    {CRAWL_CATEGORIES.map(cat => (
                      <label key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: cat.srtSq ? 'pointer' : 'not-allowed', fontSize: 13, color: cat.srtSq ? '#1A1A2E' : '#C0C8D0' }}>
                        <input
                          type="checkbox"
                          disabled={!cat.srtSq}
                          checked={crawlSelected.includes(cat.name)}
                          onChange={e => {
                            if (e.target.checked) setCrawlSelected(prev => [...prev, cat.name])
                            else setCrawlSelected(prev => prev.filter(s => s !== cat.name))
                          }}
                          style={{ width: 14, height: 14, accentColor: '#5E6AD2' }}
                        />
                        {cat.name}
                        {!cat.srtSq && <span style={{ fontSize: 10, color: '#C0C8D0' }}>준비중</span>}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className={styles.primaryBtn} style={{ opacity: crawling ? 0.6 : 1 }} disabled={crawling} onClick={startCrawl}>
                      {crawling ? '다운로드 중...' : '요약서 다운로드'}
                    </button>
                    <span style={{ fontSize: 12, color: '#8892A0' }}>카테고리당 1.5초 간격 (서버 부하 방지)</span>
                  </div>
                </div>

                {/* 결과 */}
                {crawlResults && (
                  <div className={styles.card} style={{ padding: 20 }}>
                    <p className={styles.cardTitle} style={{ marginBottom: 10 }}>
                      다운로드 결과 — 신규 {crawlResults.newCount}건 / 스킵 {crawlResults.skipCount}건 / 실패 {crawlResults.failCount}건
                    </p>
                    <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {crawlResults.results?.map((r: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ color: r.success ? '#065F46' : '#991B1B', fontWeight: 700 }}>{r.success ? '✓' : '✗'}</span>
                          <span style={{ color: '#636B78' }}>[{r.category}]</span>
                          <span style={{ color: '#1A1A2E' }}>{r.product}</span>
                          {r.error && <span style={{ color: '#991B1B' }}>— {r.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 저장된 PDF 목록 */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>메리츠화재 저장된 요약서</p>
                    <button className={styles.refreshBtn} onClick={fetchMeritzPdfs} style={{ fontSize: 12 }}>새로고침</button>
                  </div>
                  {meritzPdfs.length === 0 ? (
                    <p style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8892A0' }}>아직 다운로드된 파일이 없어요</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        {['카테고리', '상품명', '크기', '저장일'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {meritzPdfs.map(pdf => (
                          <tr key={pdf.id}>
                            <td style={tdStyle()}>{badge('#EFF6FF', '#1D4ED8', pdf.category_name)}</td>
                            <td style={tdStyle({ fontSize: 13 })}>{pdf.product_name}</td>
                            <td style={tdStyle({ color: '#636B78', fontSize: 12 })}>{pdf.file_size ? `${Math.round(pdf.file_size / 1024)}KB` : '-'}</td>
                            <td style={tdStyle({ color: '#636B78', fontSize: 12 })}>{new Date(pdf.crawled_at).toLocaleDateString('ko-KR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>)}

              {/* 미선택 안내 */}
              {!selectedInsurer && (
                <div className={styles.card} style={{ padding: 40, textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#8892A0' }}>위에서 보험사를 선택하세요</p>
                  <p style={{ fontSize: 12, color: '#C0C8D0', marginTop: 6 }}>현재 메리츠화재만 공시 API 연동 완료</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
