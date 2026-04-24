import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Company {
  id: string
  name: string
  category: string
  sort_order: number
}

interface Props {
  value: string
  onChange: (company: string) => void
  style?: React.CSSProperties
}

// 캐시: 한번 불러오면 재사용
let cachedCompanies: Company[] | null = null

export default function InsuranceCompanySelect({ value, onChange, style }: Props) {
  const [손해, set손해] = useState<Company[]>([])
  const [생명, set생명] = useState<Company[]>([])
  const [loaded, setLoaded] = useState(false)

  // 현재 value가 어느 카테고리인지 판별
  const category = 손해.find(c => c.name === value) ? '손해보험' : 생명.find(c => c.name === value) ? '생명보험' : ''

  useEffect(() => {
    async function load() {
      if (cachedCompanies) {
        set손해(cachedCompanies.filter(c => c.category === '손해보험'))
        set생명(cachedCompanies.filter(c => c.category === '생명보험'))
        setLoaded(true)
        return
      }
      const { data } = await supabase
        .from('dpa_insurance_companies')
        .select('id, name, category, sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (data) {
        cachedCompanies = data
        set손해(data.filter(c => c.category === '손해보험'))
        set생명(data.filter(c => c.category === '생명보험'))
      }
      setLoaded(true)
    }
    load()
  }, [])

  const selectStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#1a1a1a',
    ...style,
  }

  if (!loaded) return <select style={selectStyle} disabled><option>로딩중...</option></select>

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 12, color: '#666', marginBottom: 2, display: 'block' }}>손해보험</label>
        <select
          value={category === '손해보험' ? value : ''}
          onChange={e => {
            if (e.target.value) onChange(e.target.value)
          }}
          style={selectStyle}
        >
          <option value="">선택</option>
          {손해.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 12, color: '#666', marginBottom: 2, display: 'block' }}>생명보험</label>
        <select
          value={category === '생명보험' ? value : ''}
          onChange={e => {
            if (e.target.value) onChange(e.target.value)
          }}
          style={selectStyle}
        >
          <option value="">선택</option>
          {생명.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
