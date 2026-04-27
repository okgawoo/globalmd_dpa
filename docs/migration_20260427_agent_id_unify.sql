-- ============================================================
-- Migration: agent_id 통일 (auth.users.id 기준)
-- Date: 2026-04-27
-- ============================================================
-- 문제: dpa_customers.agent_id 일부가 dpa_agents.id를 참조하고 있었음
-- 해결: 전부 auth.users.id 기준으로 통일

-- ── 1. 데이터 정정 ────────────────────────────────────────
-- fca3ffe0 (admin dpa_agents.id) → 3c0a2f14 (admin auth.users.id)
UPDATE dpa_customers
SET agent_id = '3c0a2f14-e388-4d4d-ad39-b053b50a7a08'
WHERE agent_id = 'fca3ffe0-6caf-4479-bbf9-94bf75d45ef0';

-- 09cd3973 (성유준 dpa_agents.id) → 68f6715c (성유준 auth.users.id)
UPDATE dpa_customers
SET agent_id = '68f6715c-e87c-4111-a963-3190ed19c2f4'
WHERE agent_id = '09cd3973-446c-4f11-9b58-7779c83ff4a6';

-- ── 2. RLS 정책 재설계 ────────────────────────────────────
-- 기존: allow_all (public, qual: true) — 무제한 접근
-- 변경: auth.uid() = agent_id + admin 우회

-- dpa_customers
DROP POLICY IF EXISTS "allow_all" ON dpa_customers;
DROP POLICY IF EXISTS "authenticated_all_customers" ON dpa_customers;
CREATE POLICY "customers_agent_access" ON dpa_customers
  FOR ALL TO authenticated
  USING (
    agent_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
  );

-- dpa_contracts
DROP POLICY IF EXISTS "allow_all" ON dpa_contracts;
DROP POLICY IF EXISTS "authenticated_all_contracts" ON dpa_contracts;
CREATE POLICY "contracts_agent_access" ON dpa_contracts
  FOR ALL TO authenticated
  USING (
    agent_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
  );

-- dpa_coverages (agent_id 없음 → dpa_contracts 조인)
DROP POLICY IF EXISTS "allow_all" ON dpa_coverages;
DROP POLICY IF EXISTS "authenticated_all_coverages" ON dpa_coverages;
CREATE POLICY "coverages_agent_access" ON dpa_coverages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dpa_contracts ct
      WHERE ct.id = contract_id
        AND (
          ct.agent_id = auth.uid()
          OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dpa_contracts ct
      WHERE ct.id = contract_id
        AND (
          ct.agent_id = auth.uid()
          OR auth.uid() IN (SELECT user_id FROM dpa_agents WHERE email = 'admin@dpa.com')
        )
    )
  );

-- ── 결과 ──────────────────────────────────────────────────
-- dpa_customers: auth.users.id만 존재 (admin 19건, 성유준 18건)
-- dpa_contracts: 이미 auth.users.id 기준이었음 (변경 없음)
-- RLS: 각 설계사는 자신의 고객/계약/보장만 조회
--       admin@dpa.com은 전체 조회 가능
