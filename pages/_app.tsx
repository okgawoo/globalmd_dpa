import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Layout from '../components/Layout'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && router.pathname !== '/login') {
        router.replace('/login')
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && router.pathname !== '/login') {
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (router.pathname === '/login') {
    return <Component {...pageProps} />
  }

  if (checking) return null

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
