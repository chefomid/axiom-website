import { useEffect, useRef } from 'react'

/** Horizontal section picker fixed above the home indicator on phone */
export function DossierMobileNav({ sections, activeId, onSelect, className = '' }) {
  const activeRef = useRef(null)
  const scrollerRef = useRef(null)

  useEffect(() => {
    const node = activeRef.current
    const scroller = scrollerRef.current
    if (!node || !scroller) return
    const nodeLeft = node.offsetLeft
    const nodeWidth = node.offsetWidth
    const scrollerWidth = scroller.clientWidth
    const target = nodeLeft - scrollerWidth / 2 + nodeWidth / 2
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [activeId])

  return (
    <nav
      aria-label="Section navigation"
      className={`safe-bottom-bar shrink-0 border-t border-[#9AA0A8]/25 bg-[#080808]/98 backdrop-blur-md xl:hidden ${className}`}
    >
      <div
        ref={scrollerRef}
        className="sleek-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2.5 scroll-px-3 [-webkit-overflow-scrolling:touch]"
      >
        {sections.map(section => {
          const active = section.id === activeId
          return (
            <button
              key={section.id}
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={active ? 'true' : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
                active
                  ? 'border-[#9AA0A8] bg-[#9AA0A8]/15 text-white'
                  : 'border-[#333] bg-[#111] text-ink-faint hover:border-[#555] hover:text-white'
              }`}
            >
              {section.shortLabel ?? section.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
