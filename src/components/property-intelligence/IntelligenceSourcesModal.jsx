import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GhostButton, PrimaryButton } from '../ui/CommandControls'
import { INTELLIGENCE_SOURCE_GROUPS } from '../../data/intelligenceSources'

function SourceCard({ source, variant }) {
  const isVendor = variant === 'vendor'

  return (
    <li
      className={
        isVendor
          ? 'rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2.5'
          : 'rounded border border-panel-border/60 bg-black/40 px-3 py-2.5'
      }
    >
      <a
        href={source.website}
        target="_blank"
        rel="noopener noreferrer"
        className={
          isVendor
            ? 'inline-flex items-center gap-1 font-mono text-[10px] font-medium text-amber-100 underline decoration-amber-500/35 underline-offset-[3px] transition hover:text-white hover:decoration-amber-300/60'
            : 'inline-flex items-center gap-1 font-mono text-[10px] font-medium text-white underline decoration-white/20 underline-offset-[3px] transition hover:text-white hover:decoration-white/45'
        }
      >
        {source.name}
        <span aria-hidden className="text-[9px] opacity-60">
          ↗
        </span>
      </a>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary">{source.summary}</p>
      <p className="mt-1.5 font-mono text-[9px] leading-snug text-ink-muted">{source.credibility}</p>
    </li>
  )
}

function ModalBody() {
  return (
    <>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
        Source transparency
      </p>
      <h2
        id="pi-sources-title"
        className="font-display mt-1 text-xl font-semibold text-white sm:text-2xl"
      >
        Where your data comes from
      </h2>

      <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
        AXIOM does not scrape random listings or guess at COPE fields. Each report pulls from named,
        auditable sources, then labels every field with how it was obtained: verified, inferred, or
        missing.
      </p>

      {INTELLIGENCE_SOURCE_GROUPS.map(group => (
        <div key={group.id} className="mt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
            {group.label}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{group.intro}</p>
          <ul className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {group.sources.map(source => (
              <SourceCard
                key={source.id}
                source={source}
                variant={group.id === 'vendors' ? 'vendor' : 'government'}
              />
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-5 rounded border border-panel-border/70 bg-panel-surface/20 px-3.5 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
          How AXIOM uses these feeds
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary">
          Sources run in parallel at the locked property pin. When values disagree, conflict resolution
          and the SOV orchestrator reconcile lanes with explicit rationale, so you can defend what
          landed in the COPE snapshot.
        </p>
      </div>
    </>
  )
}

export default function IntelligenceSourcesModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pi-sources-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex max-h-[min(92dvh,100%)] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl md:max-h-[min(88dvh,760px)] md:rounded md:border"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#333] px-5 py-4 md:px-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                Property Intelligence
              </p>
              <GhostButton onClick={onClose}>Close</GhostButton>
            </div>

            <div className="sleek-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">
              <ModalBody />
            </div>

            <div className="shrink-0 border-t border-[#333] px-5 py-4 md:px-6">
              <div className="flex justify-end">
                <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
