import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import type { TourStep } from '../lib/tourSteps'

interface Props {
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingTour({ steps, onComplete, onSkip }: Props) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [navigating, setNavigating] = useState(false)
  const prevPageRef = useRef<string | undefined>(undefined)

  const step = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  // 스텝 변경 시 — 페이지 이동 후 타깃 탐색
  useEffect(() => {
    const needsNav = step.page && step.page !== router.pathname

    if (needsNav) {
      setNavigating(true)
      setTargetRect(null)
      router.push(step.page!)
      prevPageRef.current = step.page
    } else {
      // 같은 페이지거나 페이지 지정 없음 — 바로 타깃 탐색
      findTarget()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  // 라우터 경로 변경 완료 → 타깃 탐색
  useEffect(() => {
    if (navigating && step.page && router.pathname === step.page) {
      const t = setTimeout(() => {
        setNavigating(false)
        findTarget()
      }, 300)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, navigating])

  function findTarget() {
    if (!step.targetId) {
      setTargetRect(null)
      return
    }
    const update = () => {
      const el = document.getElementById(step.targetId!)
      if (el) setTargetRect(el.getBoundingClientRect())
      else setTargetRect(null)
    }
    update()
    const t = setTimeout(update, 150)
    return () => clearTimeout(t)
  }

  const next = () => {
    if (isLast) { onComplete(); return }
    setStepIndex(i => i + 1)
  }
  const prev = () => {
    if (!isFirst) setStepIndex(i => i - 1)
  }

  // 툴팁 카드 위치 계산
  const tooltipStyle = (): React.CSSProperties => {
    // 타깃 없음 → 화면 하단 중앙 (페이지가 보이도록)
    if (!targetRect) {
      return {
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 420,
        maxWidth: 'calc(100vw - 48px)',
      }
    }
    // 타깃 있음 → 타깃 옆
    const PAD = 20
    const W = 300
    switch (step.tooltipPosition) {
      case 'right':
        return {
          position: 'fixed',
          left: targetRect.right + PAD,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
          width: W,
        }
      case 'left':
        return {
          position: 'fixed',
          right: window.innerWidth - targetRect.left + PAD,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
          width: W,
        }
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - targetRect.top + PAD,
          left: Math.min(targetRect.left, window.innerWidth - W - 16),
          width: W,
        }
      default: // bottom
        return {
          position: 'fixed',
          top: targetRect.bottom + PAD,
          left: Math.min(targetRect.left, window.innerWidth - W - 16),
          width: W,
        }
    }
  }

  const pageStepCount = steps.filter(s => s.page).length
  // 진행 바: 페이지 스텝 기준으로 표시
  const progressSteps = steps.filter((_, i) => i === 0 || steps[i].page || i === steps.length - 1)

  return (
    <>
      {/* ── 오버레이 (페이지가 보이도록 가볍게) ── */}
      {targetRect ? (
        // 스포트라이트
        <div style={{
          position: 'fixed',
          left: targetRect.left - 6,
          top: targetRect.top - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          zIndex: 9990,
          pointerEvents: 'none',
          transition: 'all 0.25s ease',
        }} />
      ) : (
        // 페이지 전체 설명 모드 — 살짝 어둡게 (페이지 내용은 보임)
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.38)',
          pointerEvents: 'none',
        }} />
      )}

      {/* ── 클릭 블로커 ── */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9991 }}
        onClick={e => e.stopPropagation()}
      />

      {/* ── 툴팁 카드 ── */}
      <div style={{
        ...tooltipStyle(),
        zIndex: 9999,
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '22px 26px 20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
        boxSizing: 'border-box',
      }}>
        {/* 진행 바 */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= stepIndex ? '#5E6AD2' : '#E5E7EB',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* 페이지 배지 */}
        {step.page && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#EEF2FF', color: '#5E6AD2',
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 999, marginBottom: 10, letterSpacing: '0.03em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5E6AD2', display: 'inline-block' }} />
            {step.page === '/' ? '대시보드' : step.page.replace('/', '').toUpperCase()}
          </div>
        )}

        {/* 스텝 번호 */}
        {!step.page && stepIndex > 0 && (
          <p style={{ fontSize: 11, fontWeight: 600, color: '#5E6AD2', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            {isLast ? '완료' : '시작'}
          </p>
        )}

        {/* 제목 */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: '0 0 10px', lineHeight: 1.4 }}>
          {navigating ? '페이지 이동 중...' : step.title}
        </h3>

        {/* 내용 */}
        {!navigating && (
          <p style={{ fontSize: 13, color: '#636B78', lineHeight: 1.75, margin: '0 0 22px' }}>
            {step.content}
          </p>
        )}
        {navigating && (
          <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.75, margin: '0 0 22px' }}>
            잠시만 기다려 주세요...
          </p>
        )}

        {/* 버튼 행 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onSkip}
            style={{
              fontSize: 12, color: '#9CA3AF', border: 'none',
              background: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit',
            }}
          >
            건너뛰기
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={prev}
                disabled={navigating}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid #E5E7EB', background: '#FFFFFF',
                  color: '#636B78', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: navigating ? 0.4 : 1,
                }}
              >
                이전
              </button>
            )}
            <button
              onClick={next}
              disabled={navigating}
              style={{
                padding: '8px 22px', borderRadius: 8,
                border: 'none', background: navigating ? '#C7CAFE' : '#5E6AD2',
                color: '#FFFFFF', fontSize: 13, fontWeight: 600,
                cursor: navigating ? 'default' : 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
            >
              {isLast ? '시작하기 🎉' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
