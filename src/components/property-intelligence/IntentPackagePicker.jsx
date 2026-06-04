import { useState } from 'react'
import { insuranceSourcesConfigured } from '../../services/propertyApi'

const PRIMARY_INTENTS = [
  {
    id: 'publicly_available',
    title: 'Publicly available',
    subtitle: 'Free OSINT, public records, government hazards, and COPE mapper',
    accent: 'border-panel-border bg-panel-surface/40 hover:border-command-live/30',
    active: 'border-command-live/50 bg-command-live/10 ring-1 ring-command-live/20',
  },
  {
    id: 'cope_insurance',
    title: 'COPE (insurance-grade)',
    subtitle: 'ATTOM property data + hazards for carrier-credible COPE',
    accent: 'border-panel-border bg-panel-surface/40 hover:border-command-live/30',
    active: 'border-command-live/50 bg-command-live/10 ring-1 ring-command-live/20',
    premium: true,
  },
]

const MORE_INTENT_IDS = ['property_basics']

export default function IntentPackagePicker({
  presets,
  catalog,
  activePresetId,
  onApply,
  disabled,
  locationLocked,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const keysConfigured = insuranceSourcesConfigured(catalog)
  const presetById = Object.fromEntries((presets ?? []).map(p => [p.id, p]))

  if (!presets?.length) return null

  return (
    <div className="border-b border-panel-border px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Choose a package</p>
      <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
        {locationLocked
          ? 'Pick what you need.'
          : 'Confirm an address to unlock quoting.'}
      </p>

      <ul className="mt-3 space-y-2">
        {PRIMARY_INTENTS.map(intent => {
          const preset = presetById[intent.id]
          if (!preset) return null
          const selected = activePresetId === intent.id
          const isInsurance = intent.premium

          return (
            <li key={intent.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApply(intent.id)}
                className={`w-full rounded-md border px-3 py-2.5 text-left transition disabled:opacity-40 ${
                  selected ? intent.active : intent.accent
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-white">
                    {intent.title}
                  </span>
                  {selected ? (
                    <span className="shrink-0 font-mono text-[8px] uppercase tracking-widest text-command-stable">
                      Selected
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block font-mono text-[9px] leading-relaxed text-ink-muted">
                  {intent.subtitle}
                </span>
                {isInsurance && !keysConfigured ? (
                  <span className="mt-1.5 block font-mono text-[8px] leading-relaxed text-command-watch">
                    ATTOM key not on server — preset uses free sources until configured
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setMoreOpen(v => !v)}
          className="font-mono text-[9px] uppercase tracking-wider text-ink-faint transition hover:text-ink-secondary"
        >
          {moreOpen ? 'Hide' : 'More'} packages
        </button>
        {moreOpen ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MORE_INTENT_IDS.map(id => {
              const preset = presetById[id]
              if (!preset) return null
              const selected = activePresetId === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  title={preset.description}
                  onClick={() => onApply(id)}
                  className={`rounded border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition disabled:opacity-40 ${
                    selected
                      ? 'border-command-live/50 bg-command-live/10 text-white'
                      : 'border-panel-border bg-panel-surface/40 text-ink-secondary hover:border-command-live/30 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
