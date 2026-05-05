import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'

interface AdminContextValue {
  isAdmin: boolean
  loading: boolean
}

const AdminContext = createContext<AdminContextValue>({ isAdmin: false, loading: true })

// 화이트리스트 — 이 이메일만 관리자 권한 허용 (하드코드)
// 신규 가입자가 어떻게 role을 변조해도 이 이메일이 아니면 false
const ADMIN_EMAILS = ['admin@dpa.com', 'okgawoo@gmail.com']

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) { setLoading(false); return }
        return supabase.from('dpa_agents').select('role, email').eq('user_id', user.id).single()
          .then(({ data }) => {
            // 다층 검증: 이메일이 화이트리스트에 있고 + role도 admin이어야 함
            const emailOk = !!data?.email && ADMIN_EMAILS.includes(data.email)
            const roleOk = data?.role === 'admin'
            setIsAdmin(emailOk && roleOk)
            setLoading(false)
          })
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, loading }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
