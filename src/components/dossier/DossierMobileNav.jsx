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
      className={`shrink-0 border-t border-[#9AA0A8]/25 bg-[#080808]/98 backdrop-blur-md xl:hidden ${className}`}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
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

/** Bottom sheet listing platform modules (Insurance Manager) */
export function DossierModulesSheet({ open, onClose, title, intro, sections, onWalkthrough }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] xl:hidden"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-modules-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[min(85dvh,100%)] flex-col overflow-hidden rounded-t-2xl border border-[#333] bg-[#0d0d0d] shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] px-5 py-4 shrink-0">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">{title}</p>
            <h3 id="dossier-modules-title" className="mt-1 font-display text-base font-semibold text-white">
              Platform modules
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] text-ink-muted transition-colors hover:text-white"
            aria-label="Close modules"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sleek-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {intro && (
            <p className="text-[13px] leading-relaxed text-ink-secondary">{intro}</p>
          )}
          <ul className={`space-y-3 ${intro ? 'mt-4' : ''}`}>
            {sections.map(section => {
              const Tag = section.walkthrough ? 'button' : 'li'
              const props = section.walkthrough
                ? {
                    type: 'button',
                    onClick: () => {
                      onClose()
                      onWalkthrough?.()
                    },
                    className:
                      'w-full rounded-xl border border-[#3a3a3a] bg-[#141414] p-4 text-left transition-colors hover:border-[#5c5c5c]',
                  }
                : {
                    className: 'rounded-xl border border-[#2a2a2a] bg-[#111] p-4',
                  }

              return (
                <Tag key={section.title} {...props}>
                  <p className="font-display text-sm font-semibold text-white">{section.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{section.body}</p>
                  {section.walkthrough && (
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#9AA0A8]">
                      Open walkthrough
                    </p>
                  )}
                </Tag>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
