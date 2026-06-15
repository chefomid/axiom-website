import { useMemo, useState } from 'react'
import { PRESET_OPTIONAL_ADDONS } from '../../services/propertyApi'
import SourceCatalog from './SourceCatalog'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'licensed', label: 'Licensed' },
]

export default function SourceCatalogPanel({
  catalog,
  selectedSources,
  onToggle,
  disabled,
  quote,
  activePresetId,
  variant = 'default',
}) {
  const isPopover = variant === 'popover'
  const [filter, setFilter] = useState('all')
  const count = selectedSources?.length ?? 0
  const presetLabel = catalog?.presets?.find(p => p.id === activePresetId)?.label

  const filteredCatalog = useMemo(() => {
    if (!catalog?.sources) return catalog
    const withoutPackageAddons = catalog.sources.filter(
      src => !PRESET_OPTIONAL_ADDONS.includes(src.id),
    )
    const base = { ...catalog, sources: withoutPackageAddons }
    if (filter === 'all') return base
    const sources = withoutPackageAddons.filter(src => {
      if (filter === 'free') return !src.requires_api_key && src.tier !== 'insurance'
      if (filter === 'licensed') return src.requires_api_key || src.tier === 'insurance'
      return true
    })
    return { ...catalog, sources }
  }, [catalog, filter])

  const selectedInView = useMemo(() => {
    const ids = new Set((filteredCatalog?.sources ?? []).map(s => s.id))
    return selectedSources.filter(id => ids.has(id)).length
  }, [filteredCatalog, selectedSources])

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isPopover ? 'h-full' : ''}`}
    >
      <div className="shrink-0 border-b border-panel-border/70 bg-panel-surface/30 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Data sources</p>
            <p className="mt-0.5 font-mono text-[10px] text-ink-secondary">
              {count} active{presetLabel ? ` · ${presetLabel}` : ''}
            </p>
          </div>
          {filter !== 'all' ? (
            <span className="shrink-0 font-mono text-[9px] text-ink-faint">
              {selectedInView} in view
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex gap-1" role="group" aria-label="Filter sources">
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-md border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition ${
                filter === item.id
                  ? 'border-command-watch/40 bg-command-watch/10 text-command-watch'
                  : 'border-panel-border bg-panel-bg/50 text-ink-faint hover:border-[#333] hover:text-ink-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain sleek-scrollbar bg-[#080808]"
        onWheel={e => e.stopPropagation()}
      >
        <SourceCatalog
          catalog={filteredCatalog}
          vendors={catalog?.vendors}
          selectedSources={selectedSources}
          onToggle={onToggle}
          disabled={disabled}
          quote={quote}
        />
      </div>
    </div>
  )
}
