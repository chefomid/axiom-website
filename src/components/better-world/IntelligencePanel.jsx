import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  LAYER_BY_ID,
  LAYER_COLORS,
  PUBLIC_HAZARD_TAGLINE,
  SEVERITY,
  SEVERITY_HEX,
} from '../../data/commandMapData'

const SEVERITY_TEXT = {
  stable: 'text-command-stable',
  live: 'text-command-live',
  watch: 'text-command-watch',
  critical: 'text-command-critical',
}

function signalAccent(signal) {
  const severity = signal.severity ?? 'live'
  return {
    hex: SEVERITY_HEX[severity] ?? SEVERITY_HEX.live,
    text: SEVERITY_TEXT[severity] ?? SEVERITY_TEXT.live,
    label: SEVERITY[severity]?.label ?? severity,
  }
}

export default function IntelligencePanel({ signals, selectedMarkerId, onSelectSignal, scope }) {
  const listRef = useRef(null)

  useEffect(() => {
    if (!selectedMarkerId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-marker-id="${selectedMarkerId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedMarkerId])

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-panel-border bg-panel-bg/95 backdrop-blur-sm">
      <div className="shrink-0 border-b border-panel-border px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Intelligence Panel</p>
        <p className="font-display mt-1 text-sm font-medium text-white">Live Signals</p>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {signals.length} signal{signals.length === 1 ? '' : 's'} in {scope} view
        </p>
        {signals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
            {Object.entries(SEVERITY_HEX).map(([key, hex]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                {SEVERITY[key]?.label ?? key}
              </span>
            ))}
          </div>
        )}
      </div>

      <div ref={listRef} className="sleek-scrollbar flex-1 overflow-y-auto px-3 py-2">
        {signals.length === 0 ? (
          <p className="rounded border border-panel-border bg-panel-surface/60 px-3 py-4 font-mono text-[11px] leading-relaxed text-ink-muted">
            No public-data events match your scope or filters. Try Global view, widen the radius, or enable more government feeds.
          </p>
        ) : (
          <ol className="space-y-2">
            {signals.map((signal, index) => {
              const selected = selectedMarkerId === signal.markerId
              const accent = signalAccent(signal)
              const layer = LAYER_BY_ID[signal.layer]
              const layerColor = LAYER_COLORS[signal.layer] ?? '#888888'

              return (
                <li key={signal.id}>
                  <button
                    type="button"
                    data-marker-id={signal.markerId}
                    onClick={() => onSelectSignal(signal.markerId)}
                    className={`w-full rounded border bg-panel-surface/80 px-3 py-3 text-left transition-colors hover:border-[#444] ${
                      selected
                        ? 'border-[#666] bg-[#181818] ring-1 ring-offset-1 ring-offset-[#0a0a0a]'
                        : 'border-panel-border'
                    }`}
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: accent.hex,
                      ...(selected ? { boxShadow: `0 0 0 1px ${accent.hex}55` } : {}),
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1.5 pt-0.5">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-white/10"
                          style={{ backgroundColor: accent.hex }}
                          title={`${accent.label} severity`}
                          aria-hidden
                        />
                        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <motion.div
                        layout
                        className="min-w-0 flex-1"
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {layer && (
                            <span
                              className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#0a0a0a]"
                              style={{ backgroundColor: layerColor }}
                            >
                              {layer.shortLabel}
                            </span>
                          )}
                          <span
                            className={`font-mono text-[9px] uppercase tracking-[0.14em] ${accent.text}`}
                          >
                            {accent.label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-snug text-white">{signal.title}</p>
                        <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
                          Source: {signal.source} · Confidence: {signal.confidence}%
                        </p>
                        <p className={`mt-2 font-mono text-[10px] ${accent.text}`}>
                          → {signal.action}
                        </p>
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
