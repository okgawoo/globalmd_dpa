import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STATIC_손해 = [
  '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재',
  '흥국화재', '롯데손해보험', 'MG손해보험', '한화손해보험',
  'AIG손해보험', 'NH농협손해보험', '하나손해보험', '캐롯손해보험', 'AXA손해보험',
]
const STATIC_생명 = [
  '삼성생명', '한화생명', '교보생명', '신한라이프', 'DB생명', '흥국생명',
  '동양생명', '미래에셋생명', '푸본현대생명', '메트라이프', 'AIA생명',
  '라이나생명', '하나생명', 'ABL생명', 'KDB생명', 'NH농협생명', 'KB라이프',
  '처브라이프', '카디프생명', 'iM라이프', 'IBK연금보험', 'PCA생명',
  '유니버셜생명', '오렌지라이프', '푸르덴셜생명', 'MG새마을금고',
]

interface Company { id?: string; name: string; category: string; sort_order?: number }
interface Props {
  value: string
  onChange: (company: string) => void
  style?: React.CSSProperties
}

let cachedCompanies: Company[] | null = null

function useDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

function SearchableSelect({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dark = useDark()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query
    ? options.filter(n => n.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      <label style={{ fontSize: 12, color: '#636B78', marginBottom: 2, display: 'block' }}>{label}</label>
      <div
        style={{
          width: '100%',
          fontSize: 13,
          padding: '6px 10px',
          borderRadius: 6,
          border: `1px solid ${open ? '#5E6AD2' : dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`,
          background: dark ? '#2a2a2a' : '#F7F8FA',
          color: value ? (dark ? '#E0E0E0' : '#1A1A2E') : '#9CA3AF',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
        onClick={() => { setOpen(!open); setQuery('') }}
      >
        <span>{value || `-- ${label} 선택 --`}</span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          background: dark ? '#2a2a2a' : '#fff',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`,
          borderRadius: 6,
          boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: 220,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#F3F4F6'}` }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="검색..."
              style={{
                width: '100%',
                fontSize: 12,
                padding: '4px 8px',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`,
                borderRadius: 4,
                outline: 'none',
                boxSizing: 'border-box',
                background: dark ? '#222' : '#fff',
                color: dark ? '#E0E0E0' : '#1A1A2E',
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div
            style={{ padding: '6px 12px', fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}
            onMouseDown={e => { e.preventDefault(); onChange(''); setOpen(false); setQuery('') }}
          >
            -- 선택 안 함 --
          </div>
          <div
            style={{ overflowY: 'auto', flex: 1 }}
            onWheel={e => e.stopPropagation()}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#9CA3AF' }}>검색 결과 없음</div>
            ) : (
              filtered.map(name => (
                <div
                  key={name}
                  onMouseDown={e => { e.preventDefault(); onChange(name); setOpen(false); setQuery('') }}
                  style={{
                    padding: '7px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: value === name ? (dark ? 'rgba(94,106,210,0.25)' : '#EEF0FD') : 'transparent',
                    color: value === name ? '#5E6AD2' : (dark ? '#E0E0E0' : '#1A1A2E'),
                    fontWeight: value === name ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (value !== name) (e.target as HTMLDivElement).style.background = dark ? 'rgba(255,255,255,0.06)' : '#F7F8FA' }}
                  onMouseLeave={e => { if (value !== name) (e.target as HTMLDivElement).style.background = 'transparent' }}
                >
                  {name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function InsuranceCompanySelect({ value, onChange }: Props) {
  const [손해, set손해] = useState<string[]>(STATIC_손해)
  const [생명, set생명] = useState<string[]>(STATIC_생명)

  useEffect(() => {
    async function load() {
      if (cachedCompanies) { mergeFromDB(cachedCompanies); return }
      const { data } = await supabase
        .from('dpa_insurance_companies')
        .select('id, name, category, sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (data) { cachedCompanies = data; mergeFromDB(data) }
    }
    function mergeFromDB(data: Company[]) {
      const dbSonhae = data.filter(c => c.category === '손해보험').map(c => c.name)
      const dbSaengmyeong = data.filter(c => c.category === '생명보험').map(c => c.name)
      set손해([...STATIC_손해, ...dbSonhae.filter(n => !STATIC_손해.includes(n))])
      set생명([...STATIC_생명, ...dbSaengmyeong.filter(n => !STATIC_생명.includes(n))])
    }
    load()
  }, [])

  const is손해 = 손해.includes(value)
  const is생명 = 생명.includes(value)

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <SearchableSelect
        label="손해보험"
        options={손해}
        value={is손해 ? value : ''}
        onChange={v => { if (v) onChange(v); else if (is손해) onChange('') }}
      />
      <SearchableSelect
        label="생명보험"
        options={생명}
        value={is생명 ? value : ''}
        onChange={v => { if (v) onChange(v); else if (is생명) onChange('') }}
      />
    </div>
  )
}
