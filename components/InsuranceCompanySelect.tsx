import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
  const listId = useRef(`ins-co-${Math.random().toString(36).slice(2)}`).current
  const [companies, setCompanies] = useState<Company[]>([])
  const [loaded, setLoaded] = useState(false)
  const [inputVal, setInputVal] = useState(value)

  // 외부에서 value가 바뀌면 input도 동기화
  useEffect(() => { setInputVal(value) }, [value])

  useEffect(() => {
    async function load() {
      if (cachedCompanies) {
        setCompanies(cachedCompanies)
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
        setCompanies(data)
      }
      setLoaded(true)
    }
    load()
  }, [])

  // 손해보험 → 생명보험 순 정렬
  const sorted = [
    ...companies.filter(c => c.category === '손해보험'),
    ...companies.filter(c => c.category === '생명보험'),
  ]

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #E5E7EB',
    background: '#F7F8FA',
    color: '#1A1A2E',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 120ms',
    ...style,
  }

  return (
    <>
      <input
        list={listId}
        value={inputVal}
        disabled={!loaded}
        placeholder={loaded ? '보험사명 입력 또는 선택...' : '로딩 중...'}
        onChange={e => {
          const v = e.target.value
          setInputVal(v)
          onChange(v)
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#5E6AD2'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(94,106,210,0.15)'; e.currentTarget.style.background = '#ffffff' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#F7F8FA' }}
        style={inputStyle}
      />
      <datalist id={listId}>
        {sorted.map(c => (
          <option key={c.id} value={c.name} label={`[${c.category}] ${c.name}`} />
        ))}
      </datalist>
    </>
  )
}
