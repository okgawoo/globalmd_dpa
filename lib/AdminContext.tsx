import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'

interface AdminContextValue {
  isAdmin: boolean
  loading: boolean
}

const AdminContext = createContext<AdminContextValue>({ isAdmin: false, loading: true })

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) { setLoading(false); return }
        return supabase.from('dpa_agents').select('role').eq('user_id', user.id).single()
          .then(({ data }) => {
            setIsAdmin(data?.role === 'admin')
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
