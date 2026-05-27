// Operational event log — wired to API fetch results, layer/source toggles, scope, and marker selection.
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelemetry } from '../../context/TelemetryContext'

const TYPE_COLOR = {
  stable: 'text-command-stable',
  live: 'text-command-live',
  watch: 'text-command-watch',
  critical: 'text-command-critical',
}

export default function TelemetryFeed() {
  const { entries } = useTelemetry()
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <div className="relative shrink-0 border-t border-panel-border bg-[#060606]/95 backdrop-blur-sm">
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="flex items-center gap-4 border-b border-panel-border px-4 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Event Log</p>
        <p className="font-mono text-[9px] text-ink-faint">Live system telemetry</p>
      </div>
      <div ref={scrollRef} className="sleek-scrollbar max-h-[108px] overflow-y-auto px-4 py-2">
        <AnimatePresence initial={false}>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="font-mono text-[11px] leading-relaxed text-ink-muted"
            >
              <span className="tabular-nums text-ink-faint">[{entry.time}]</span>{' '}
              <span className="text-ink-faint">{entry.source} · </span>
              <span className={TYPE_COLOR[entry.type] ?? 'text-ink-muted'}>{entry.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
