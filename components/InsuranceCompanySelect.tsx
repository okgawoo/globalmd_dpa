import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// 정적 전체 목록 (DB에 없는 보험사 포함)
const STATIC_손해 = [
  '삼성화재', '현대해상', 'DB손해보험', 'KB손해보험', '메리츠화재',
  '흥국화재', '롯데손해보험', 'MG손해보험', 'MG새마을금고', '한화손해보험',
  'AIG손해보험', 'NH농협손해보험', '하나손해보험', '캐롯손해보험', 'AXA손해보험',
]
const STATIC_생명 = [
  '삼성생명', '한화생명', '교보생명', '신한라이프', 'DB생명', '흥국생명',
  '동양생명', '미래에셋생명', '푸본현대생명', '메트라이프', 'AIA생명',
  '라이나생명', '하나생명', 'ABL생명', 'KDB생명', 'NH농협생명', 'KB라이프',
  '처브라이프', '카디프생명', 'iM라이프', 'IBK연금보험', 'PCA생명',
  '유니버셜생명', '오렌지라이프', '푸르덴셜생명',
]

interface Company { id?: string; name: string; category: string; sort_order?: number }
interface Props {
  value: string
  onChange: (company: string) => void
  style?: React.CSSProperties
}

let cachedCompanies: Company[] | null = null

export default function InsuranceCompanySelect({ value, onChange, style }: Props) {
  const [손해, set손해] = useState<string[]>(STATIC_손해)
  const [생명, set생명] = useState<string[]>(STATIC_생명)

  // Supabase에서 추가 목록 로드 후 머지
  useEffect(() => {
    async function load() {
      if (cachedCompanies) {
        mergeFromDB(cachedCompanies)
        return
      }
      const { data } = await supabase
        .from('dpa_insurance_companies')
        .select('id, name, category, sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (data) {
        cachedCompanies = data
        mergeFromDB(data)
      }
    }

    function mergeFromDB(data: Company[]) {
      const dbSonhae = data.filter(c => c.category === '손해보험').map(c => c.name)
      const dbSaengmyeong = data.filter(c => c.category === '생명보험').map(c => c.name)
      // 정적 목록 + DB 목록 머지 (중복 제거, 정적 순서 우선)
      const merged손해 = [...STATIC_손해, ...dbSonhae.filter(n => !STATIC_손해.includes(n))]
      const merged생명 = [...STATIC_생명, ...dbSaengmyeong.filter(n => !STATIC_생명.includes(n))]
      set손해(merged손해)
      set생명(merged생명)
    }

    load()
  }, [])

  // 현재 값이 어느 카테고리인지 판별
  const is손해 = 손해.includes(value)
  const is생명 = 생명.includes(value)

  const selectStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #E5E7EB',
    background: '#F7F8FA',
    color: '#1A1A2E',
    fontFamily: 'inherit',
    cursor: 'pointer',
    ...style,
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 12, color: '#636B78', marginBottom: 2, display: 'block' }}>손해보험</label>
        <select
          value={is손해 ? value : ''}
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          style={selectStyle}
        >
          <option value="">선택</option>
          {손해.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ fontSize: 12, color: '#636B78', marginBottom: 2, display: 'block' }}>생명보험</label>
        <select
          value={is생명 ? value : ''}
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          style={selectStyle}
        >
          <option value="">선택</option>
          {생명.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    </div>
  )
}
