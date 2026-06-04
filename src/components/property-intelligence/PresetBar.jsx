export default function PresetBar({ presets, onApply, disabled }) {
  if (!presets?.length) return null

  return (
    <div className="border-b border-panel-border px-4 py-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Presets</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => {
          const isInsurance = preset.highlight === 'insurance' || preset.id === 'cope_insurance'
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.description}
              onClick={() => onApply(preset.id)}
              className={`rounded border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition disabled:opacity-40 ${
                isInsurance
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                  : 'border-panel-border bg-panel-surface/40 text-ink-secondary hover:border-command-live/30 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
