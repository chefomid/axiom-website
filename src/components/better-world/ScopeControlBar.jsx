import { COUNTRIES, RADIUS_OPTIONS, stepRadiusMiles } from '../../data/commandMapData'
import { ScopePill } from '../ui/CommandControls'

export default function ScopeControlBar({
  scope,
  radiusMiles,
  countryId,
  userLocation,
  eventCount,
  onOpenModal,
  onRadiusChange,
}) {
  const countryLabel = COUNTRIES.find(c => c.id === countryId)?.label ?? countryId
  const canStepRadius = scope === 'local' && Boolean(userLocation) && typeof onRadiusChange === 'function'
  const atMin = radiusMiles <= RADIUS_OPTIONS[0]
  const atMax = radiusMiles >= RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]

  const scopeSummary = () => {
    if (scope === 'local') {
      if (!userLocation) return 'Local · set location'
      return `Local · ${radiusMiles} mi · ${eventCount} pts`
    }
    if (scope === 'national') return `National · ${countryLabel} · ${eventCount} pts`
    return `Global · ${eventCount} pts`
  }

  return (
    <div className="absolute left-3 top-3 z-20 flex items-start gap-2 sm:left-4">
      <ScopePill label="Scope" value={scopeSummary()} onClick={onOpenModal} />

      {canStepRadius ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#2e2e2e] bg-[#0a0a0a]/94 backdrop-blur-md">
          <button
            type="button"
            aria-label="Increase search radius"
            disabled={atMax}
            onClick={() => onRadiusChange(stepRadiusMiles(radiusMiles, 1))}
            className="px-3 py-1.5 font-mono text-[13px] leading-none text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-ink-faint"
          >
            +
          </button>
          <div className="border-t border-[#2e2e2e]" />
          <button
            type="button"
            aria-label="Decrease search radius"
            disabled={atMin}
            onClick={() => onRadiusChange(stepRadiusMiles(radiusMiles, -1))}
            className="px-3 py-1.5 font-mono text-[13px] leading-none text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-ink-faint"
          >
            -
          </button>
        </div>
      ) : null}
    </div>
  )
}
