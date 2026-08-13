import { useEffect, useState } from 'react'
import {
  TYPEWRITER_MESSAGES,
  typewriterDelayMs,
  typewriterStep,
} from '../../utils/typewriterCycle'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function AnalysisLoadingOverlay() {
  const [frame, setFrame] = useState({
    text: '',
    messageIndex: 0,
    phase: 'typing',
  })

  useEffect(() => {
    if (!prefersReducedMotion()) return undefined
    setFrame({
      text: TYPEWRITER_MESSAGES[0],
      messageIndex: 0,
      phase: 'holding',
    })
    const timer = setInterval(() => {
      setFrame(prev => {
        const next = (prev.messageIndex + 1) % TYPEWRITER_MESSAGES.length
        return {
          text: TYPEWRITER_MESSAGES[next],
          messageIndex: next,
          phase: 'holding',
        }
      })
    }, 1600)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const delay = typewriterDelayMs(frame.phase)
    const timer = setTimeout(() => {
      setFrame(prev => typewriterStep(prev))
    }, delay)
    return () => clearTimeout(timer)
  }, [frame])

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading, connecting with data source"
    >
      <div className="min-w-[21.5rem] rounded border border-[#333] bg-[#0d0d0d]/95 px-3 py-2 shadow-lg">
        <p className="flex items-center font-mono text-[10px] tracking-[0.14em] text-ink-secondary">
          <span>{frame.text}</span>
          <span className="eq-loading-caret" aria-hidden>
            |
          </span>
        </p>
      </div>
    </div>
  )
}
