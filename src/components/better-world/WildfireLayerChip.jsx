import { LAYER_COLORS } from '../../data/commandMapData'
import { WILDFIRE_KIND_OPTIONS } from '../../utils/wildfireDisplay'
import WildfireFlameIcon from './WildfireFlameIcon'

export default function WildfireLayerChip({
  active,
  count = 0,
  loading = false,
  kind = 'both',
  onToggleLayer,
  onKindChange,
}) {
  const color = LAYER_COLORS.wildfire

  return (
    <div
      className={`inline-flex flex-col items-stretch gap-1.5 rounded-2xl border px-2.5 py-2 transition-all duration-200 ${
        active
          ? 'border-[#4a4a4a] bg-[#141414] text-white ring-1 ring-white/10'
          : 'border-[#383838] bg-[#0e0e0e]/80 text-ink-faint'
      }`}
    >
      <button
        type="button"
        onClick={onToggleLayer}
        aria-pressed={active}
        aria-busy={loading || undefined}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-wide"
      >
        <WildfireFlameIcon active={active} className={loading ? 'h-2.5 w-2.5 animate-pulse' : 'h-2.5 w-2.5'} />
        <span>
          Wildfire
          {!loading && count > 0 ? ` · ${count}` : ''}
        </span>
      </button>
      <div
        role="radiogroup"
        aria-label="Wildfire display"
        className={`flex flex-wrap gap-1 ${active ? '' : 'opacity-55'}`}
      >
        {WILDFIRE_KIND_OPTIONS.map(opt => {
          const selected = kind === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onKindChange?.(opt.id)}
              className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] transition-colors ${
                selected && active
                  ? 'border-white/25 bg-white/15 text-white'
                  : 'border-[#333] bg-transparent text-ink-faint hover:border-[#555] hover:text-white'
              }`}
              style={selected && active ? { boxShadow: `0 0 8px ${color}55` } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
