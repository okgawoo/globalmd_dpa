import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type PlanType = 'demo' | 'basic' | 'standard' | 'pro'

export interface PlanInfo {
  plan: PlanType
  isDemo: boolean
  isDemoExpired: boolean
  demoExpiresAt: Date | null
  demoDaysLeft: number | null
  maxCustomers: number
  canSendSms: boolean
  smsLimit: number
  canUseAdvancedAnalysis: boolean
  canUseAutoScraping: boolean
  canExportCsv: boolean
  csvExportLimit: number // 월 횟수
}

const PLAN_LIMITS: Record<PlanType, Omit<PlanInfo, 'plan' | 'isDemo' | 'isDemoExpired' | 'demoExpiresAt' | 'demoDaysLeft'>> = {
  demo: {
    maxCustomers: 5,
    canSendSms: false,
    smsLimit: 0,
    canUseAdvancedAnalysis: false,
    canUseAutoScraping: false,
    canExportCsv: false,
    csvExportLimit: 0,
  },
  basic: {
    maxCustomers: 100,
    canSendSms: false,
    smsLimit: 0,
    canUseAdvancedAnalysis: false,
    canUseAutoScraping: false,
    canExportCsv: true,
    csvExportLimit: 1,
  },
  standard: {
    maxCustomers: 300,
    canSendSms: true,
    smsLimit: 500,
    canUseAdvancedAnalysis: true,
    canUseAutoScraping: false,
    canExportCsv: true,
    csvExportLimit: 3,
  },
  pro: {
    maxCustomers: 999999,
    canSendSms: true,
    smsLimit: 1000,
    canUseAdvancedAnalysis: true,
    canUseAutoScraping: true,
    canExportCsv: true,
    csvExportLimit: 999,
  },
}

export function usePlan(): PlanInfo {
  const [planInfo, setPlanInfo] = useState<PlanInfo>({
    plan: 'basic',
    isDemo: false,
    isDemoExpired: false,
    demoExpiresAt: null,
    demoDaysLeft: null,
    ...PLAN_LIMITS['basic'],
  })

  useEffect(() => {
    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: agent } = await supabase
        .from('dpa_agents')
        .select('plan_type, demo_expires_at, settings')
        .eq('user_id', user.id)
        .single()

      if (!agent) return

      // settings.plan 우선, 없으면 plan_type 사용
      const plan: PlanType = agent.settings?.plan || agent.plan_type || 'basic'
      const isDemo = plan === 'demo'
      const demoExpiresAt = agent.demo_expires_at ? new Date(agent.demo_expires_at) : null
      const now = new Date()
      const isDemoExpired = isDemo && demoExpiresAt ? demoExpiresAt < now : false
      const demoDaysLeft = isDemo && demoExpiresAt
        ? Math.max(0, Math.ceil((demoExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null

      setPlanInfo({
        plan,
        isDemo,
        isDemoExpired,
        demoExpiresAt,
        demoDaysLeft,
        ...PLAN_LIMITS[plan],
      })
    }
    fetchPlan()
  }, [])

  return planInfo
}
