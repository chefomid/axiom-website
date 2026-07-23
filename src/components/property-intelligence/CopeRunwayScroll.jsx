import { useCallback, useEffect, useRef, useState } from 'react'

const EDGE_ZONE_PX = 72
const MAX_SPEED_PX_PER_MS = 0.62
const NUDGE_FRACTION = 0.78
const OVERFLOW_EPS = 3

function easeInCubic(t) {
  return t * t * t
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Horizontal runway scroller with overflow chevrons and edge-proximity auto-scroll.
 */
export default function CopeRunwayScroll({ children, className = '' }) {
  const scrollRef = useRef(null)
  const rafRef = useRef(0)
  const velocityRef = useRef(0)
  const lastTsRef = useRef(0)
  const [overflow, setOverflow] = useState({ left: false, right: false })

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const left = maxScroll > OVERFLOW_EPS && el.scrollLeft > OVERFLOW_EPS
    const right = maxScroll > OVERFLOW_EPS && el.scrollLeft < maxScroll - OVERFLOW_EPS
    setOverflow(prev => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined

    updateOverflow()

    const onScroll = () => updateOverflow()
    el.addEventListener('scroll', onScroll, { passive: true })

    const resizeObserver = new ResizeObserver(() => updateOverflow())
    resizeObserver.observe(el)
    if (el.firstElementChild) resizeObserver.observe(el.firstElementChild)

    const mutationObserver = new MutationObserver(() => updateOverflow())
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true })

    window.addEventListener('resize', updateOverflow)

    return () => {
      el.removeEventListener('scroll', onScroll)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', updateOverflow)
    }
  }, [updateOverflow])

  const stopAutoScroll = useCallback(() => {
    velocityRef.current = 0
    lastTsRef.current = 0
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const tick = useCallback(
    timestamp => {
      const el = scrollRef.current
      if (!el) {
        rafRef.current = 0
        return
      }

      if (!lastTsRef.current) lastTsRef.current = timestamp
      const dt = Math.min(34, timestamp - lastTsRef.current)
      lastTsRef.current = timestamp

      const velocity = velocityRef.current
      if (velocity !== 0) {
        el.scrollLeft += velocity * dt
        const maxScroll = el.scrollWidth - el.clientWidth
        if (el.scrollLeft <= 0 && velocity < 0) {
          el.scrollLeft = 0
          velocityRef.current = 0
        } else if (el.scrollLeft >= maxScroll && velocity > 0) {
          el.scrollLeft = maxScroll
          velocityRef.current = 0
        }
        updateOverflow()
      }

      if (velocityRef.current !== 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = 0
        lastTsRef.current = 0
      }
    },
    [updateOverflow],
  )

  const ensureLoop = useCallback(() => {
    if (!rafRef.current) {
      lastTsRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  const setVelocityFromClientX = useCallback(
    clientX => {
      const el = scrollRef.current
      if (!el || prefersReducedMotion()) {
        velocityRef.current = 0
        return
      }

      const rect = el.getBoundingClientRect()
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= OVERFLOW_EPS) {
        velocityRef.current = 0
        return
      }

      const x = clientX - rect.left
      let next = 0

      if (x < EDGE_ZONE_PX && el.scrollLeft > OVERFLOW_EPS) {
        const t = easeInCubic(1 - Math.max(0, x) / EDGE_ZONE_PX)
        next = -MAX_SPEED_PX_PER_MS * t
      } else if (x > rect.width - EDGE_ZONE_PX && el.scrollLeft < maxScroll - OVERFLOW_EPS) {
        const t = easeInCubic(1 - Math.max(0, rect.width - x) / EDGE_ZONE_PX)
        next = MAX_SPEED_PX_PER_MS * t
      }

      velocityRef.current = next
      if (next !== 0) ensureLoop()
    },
    [ensureLoop],
  )

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll])

  const nudge = useCallback(
    direction => {
      const el = scrollRef.current
      if (!el) return
      const distance = Math.max(220, el.clientWidth * NUDGE_FRACTION) * direction
      const reduced = prefersReducedMotion()
      el.scrollBy({ left: distance, behavior: reduced ? 'auto' : 'smooth' })
      window.setTimeout(updateOverflow, reduced ? 0 : 320)
    },
    [updateOverflow],
  )

  return (
    <div
      className={`cope-runway-scroller ${overflow.left ? 'cope-runway-scroller--left' : ''} ${
        overflow.right ? 'cope-runway-scroller--right' : ''
      } ${className}`.trim()}
      onPointerLeave={stopAutoScroll}
      onPointerMove={event => setVelocityFromClientX(event.clientX)}
    >
      <div ref={scrollRef} className="cope-runway__scroll">
        {children}
      </div>

      {overflow.left ? (
        <button
          type="button"
          className="cope-runway-scroller__chevron cope-runway-scroller__chevron--left"
          aria-label="Scroll left"
          onClick={() => nudge(-1)}
          onPointerEnter={() => {
            if (!prefersReducedMotion()) {
              velocityRef.current = -MAX_SPEED_PX_PER_MS
              ensureLoop()
            }
          }}
          onPointerLeave={event => setVelocityFromClientX(event.clientX)}
        >
          <span aria-hidden>‹</span>
        </button>
      ) : null}

      {overflow.right ? (
        <button
          type="button"
          className="cope-runway-scroller__chevron cope-runway-scroller__chevron--right"
          aria-label="Scroll right"
          onClick={() => nudge(1)}
          onPointerEnter={() => {
            if (!prefersReducedMotion()) {
              velocityRef.current = MAX_SPEED_PX_PER_MS
              ensureLoop()
            }
          }}
          onPointerLeave={event => setVelocityFromClientX(event.clientX)}
        >
          <span aria-hidden>›</span>
        </button>
      ) : null}
    </div>
  )
}
