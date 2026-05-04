import { useState, useEffect } from 'react'
import type { TourStep } from '../lib/tourSteps'

interface Props {
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingTour({ steps, onComplete, onSkip }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const step = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  useEffect(() => {
    if (!step.targetId) {
      setTargetRect(null)
      return
    }
    const update = () => {
      const el = document.getElementById(step.targetId)
      if (el) setTargetRect(el.getBoundingClientRect())
    }
    update()
    const t = setTimeout(update, 80)
    return () => clearTimeout(t)
  }, [stepIndex, step.targetId])

  const next = () => isLast ? onComplete() : setStepIndex(i => i + 1)
  const prev = () => { if (!isFirst) setStepIndex(i => i - 1) }

  // 툴팁 위치 계산
  const tooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
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
      case 'bottom':
        return {
          position: 'fixed',
          top: targetRect.bottom + PAD,
          left: Math.min(targetRect.left, window.innerWidth - W - 16),
          width: W,
        }
      case 'top':
        return {
          position: 'fixed',
          bottom: window.innerHeight - targetRect.top + PAD,
          left: Math.min(targetRect.left, window.innerWidth - W - 16),
          width: W,
        }
      default:
        return {
          position: 'fixed',
          left: targetRect.right + PAD,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
          width: W,
        }
    }
  }

  return (
    <>
      {/* 스포트라이트 오버레이 */}
      {targetRect ? (
        <div
          style={{
            position: 'fixed',
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            zIndex: 9990,
            pointerEvents: 'none',
            transition: 'all 0.25s ease',
          }}
        />
      ) : (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.62)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 클릭 블로커 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9991 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* 툴팁 카드 */}
      <div
        style={{
          ...tooltipStyle(),
          zIndex: 9999,
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '22px 24px 20px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          width: targetRect ? 300 : 360,
          maxWidth: 'calc(100vw - 32px)',
          boxSizing: 'border-box',
        }}
      >
        {/* 진행 바 */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: i <= stepIndex ? '#5E6AD2' : '#E5E7EB',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* 스텝 번호 */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#5E6AD2', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>
          {stepIndex === 0 ? '시작' : stepIndex === steps.length - 1 ? '완료' : `${stepIndex} / ${steps.length - 2}`}
        </p>

        {/* 제목 */}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: '0 0 10px', lineHeight: 1.4 }}>
          {step.title}
        </h3>

        {/* 내용 */}
        <p style={{ fontSize: 13, color: '#636B78', lineHeight: 1.7, margin: '0 0 20px' }}>
          {step.content}
        </p>

        {/* 버튼 행 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onSkip}
            style={{
              fontSize: 12, color: '#9CA3AF', border: 'none',
              background: 'none', cursor: 'pointer', padding: '4px 0',
              fontFamily: 'inherit',
            }}
          >
            건너뛰기
          </button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isFirst && (
              <button
                onClick={prev}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid #E5E7EB', background: '#FFFFFF',
                  color: '#636B78', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                이전
              </button>
            )}
            <button
              onClick={next}
              style={{
                padding: '7px 20px', borderRadius: 8,
                border: 'none', background: '#5E6AD2',
                color: '#FFFFFF', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
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
