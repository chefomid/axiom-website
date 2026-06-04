import { useState } from 'react'
import SourceCatalog from './SourceCatalog'
import { VendorKeysInline } from './VendorKeysStatus'

export default function SourceCatalogPanel({
  catalog,
  selectedSources,
  onToggle,
  disabled,
  quote,
  activePresetId,
  apiOnline,
}) {
  const [open, setOpen] = useState(false)
  const count = selectedSources?.length ?? 0
  const presetLabel = catalog?.presets?.find(p => p.id === activePresetId)?.label

  return (
    <div className="border-b border-panel-border">
      <div className="px-4 pb-1.5 pt-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Sources</p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-secondary">
            {count} selected{presetLabel ? ` · ${presetLabel}` : count > 0 ? ' · custom mix' : ''}
          </p>
        </div>
        {apiOnline ? <VendorKeysInline apiOnline={apiOnline} className="mt-2" /> : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition hover:bg-panel-surface/30"
      >
        <span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Customize sources
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-ink-secondary">
            {count} selected
            {presetLabel ? ` · ${presetLabel}` : count > 0 ? ' · custom mix' : ''}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[10px] text-ink-faint" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="max-h-[min(42vh,360px)] min-h-0 overflow-hidden">
          <SourceCatalog
            catalog={catalog}
            vendors={catalog?.vendors}
            selectedSources={selectedSources}
            onToggle={onToggle}
            disabled={disabled}
            quote={quote}
          />
        </div>
      ) : null}
    </div>
  )
}
