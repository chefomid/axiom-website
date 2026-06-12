// Activity log, user-facing updates for map actions and live data loads.
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelemetry } from '../../context/TelemetryContext'
import { telemetrySourceForFeed } from '../../utils/userTelemetry'

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
      <div className="flex items-center gap-4 border-b border-panel-border px-4 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Activity</p>
        <p className="font-mono text-[9px] text-ink-faint">Recent updates</p>
      </div>
      <div ref={scrollRef} className="sleek-scrollbar max-h-[96px] overflow-y-auto px-4 py-2">
        <AnimatePresence initial={false}>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="font-mono text-[11px] leading-relaxed text-ink-muted"
            >
              <span className="tabular-nums text-ink-faint">[{entry.time}]</span>{' '}
              <span className="text-ink-faint">{telemetrySourceForFeed(entry.source)} · </span>
              <span className={TYPE_COLOR[entry.type] ?? 'text-ink-muted'}>{entry.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
