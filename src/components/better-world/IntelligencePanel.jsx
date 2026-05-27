import { motion } from 'framer-motion'
import { PUBLIC_HAZARD_TAGLINE } from '../../data/commandMapData'

const STRIPE = {
  stable: 'border-l-command-stable',
  live: 'border-l-command-live',
  watch: 'border-l-command-watch',
  critical: 'border-l-command-critical',
}

export default function IntelligencePanel({ signals, selectedMarkerId, onSelectSignal, scope }) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-panel-border bg-panel-bg/95 backdrop-blur-sm">
      <div className="shrink-0 border-b border-panel-border px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Intelligence Panel</p>
        <p className="font-display mt-1 text-sm font-medium text-white">Live Signals</p>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {signals.length} signal{signals.length === 1 ? '' : 's'} in {scope} view
        </p>
      </div>

      <div className="sleek-scrollbar flex-1 overflow-y-auto px-3 py-2">
        {signals.length === 0 ? (
          <p className="rounded border border-panel-border bg-panel-surface/60 px-3 py-4 font-mono text-[11px] leading-relaxed text-ink-muted">
            No public-data events match your scope or filters. Try Global view, widen the radius, or enable more government feeds.
          </p>
        ) : (
          <ol className="space-y-2">
            {signals.map((signal, index) => {
              const selected = selectedMarkerId === signal.markerId
              return (
                <li key={signal.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSignal(signal.markerId)}
                    className={`w-full rounded border border-panel-border bg-panel-surface/80 px-3 py-3 text-left transition-colors hover:border-[#333] ${
                      selected ? 'border-[#555] bg-[#161616]' : ''
                    } border-l-2 ${STRIPE[signal.severity]}`}
                  >
                    <div className="flex gap-3">
                      <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <motion.div
                        layout
                        className="min-w-0 flex-1"
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.15 }}
                      >
                        <p className="text-sm leading-snug text-white">{signal.title}</p>
                        <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
                          Source: {signal.source} · Confidence: {signal.confidence}%
                        </p>
                        <p className="mt-2 font-mono text-[10px] text-command-live">→ {signal.action}</p>
                      </motion.div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="shrink-0 border-t border-panel-border px-4 py-3">
        <p className="font-mono text-[10px] leading-relaxed text-ink-secondary">{PUBLIC_HAZARD_TAGLINE}</p>
      </div>
    </aside>
  )
}
