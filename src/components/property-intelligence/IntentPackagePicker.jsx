import {
  insuranceSourcesConfigured,
  openAiConfigured,
} from '../../services/propertyApi'

const WEB_SEARCH_SOURCE_ID = 'web_property_research'
const VISION_SOURCE_ID = 'vision_construction'

const PRIMARY_INTENTS = [
  {
    id: 'publicly_available',
    title: 'Publicly available',
    description: 'Public records, hazards, COPE map',
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-live/60 bg-command-live/12',
    selectedMark: 'border-command-live bg-command-live/20 text-command-live',
  },
  {
    id: 'cope_insurance',
    title: 'Property dossier',
    description: 'Licensed ATTOM data, hazards, PDF export',
    tag: 'Licensed',
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-watch/60 bg-command-watch/12',
    selectedMark: 'border-command-watch bg-command-watch/20 text-command-watch',
    premium: true,
  },
]

function PackageButton({ intent, selected, disabled, warning, onClick, stacked = false }) {
  const mark = (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
        selected ? intent.selectedMark : 'border-white/25 bg-black/40'
      }`}
      aria-hidden
    >
      {selected ? <span className="font-mono text-[9px] leading-none">✓</span> : null}
    </span>
  )

  if (stacked) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={warning ?? `${intent.description}${intent.tag ? ` · ${intent.tag}` : ''}`}
        onClick={onClick}
        className={`workflow-package-card isolate w-full rounded-lg border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
          selected ? intent.active : intent.accent
        }`}
      >
        <div className="flex items-center gap-3">
          {mark}
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white">
                {intent.title}
              </span>
              {intent.tag ? (
                <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-command-watch">
                  {intent.tag}
                </span>
              ) : null}
            </span>
            {warning ? (
              <span className="mt-1.5 block font-mono text-[10px] leading-snug text-command-watch">
                {warning}
              </span>
            ) : (
              <span className="mt-1.5 block font-mono text-[10px] leading-relaxed text-ink-faint">
                {intent.description}
              </span>
            )}
          </span>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={warning ?? `${intent.description}${intent.tag ? ` · ${intent.tag}` : ''}`}
      onClick={onClick}
      className={`workflow-package-btn flex w-full items-center gap-3 rounded-md border px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? intent.active : intent.accent
      }`}
    >
      <span className="flex min-w-0 w-[42%] shrink-0 items-center gap-2">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition ${
            selected ? intent.selectedMark : 'border-panel-border bg-black/30'
          }`}
          aria-hidden
        >
          {selected ? <span className="font-mono text-[9px] leading-none">✓</span> : null}
        </span>
        <span className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-white">
          {intent.title}
        </span>
      </span>

      <span className="min-w-0 flex-1 text-right">
        {warning ? (
          <span className="block font-mono text-[9px] leading-snug text-command-watch">{warning}</span>
        ) : (
          <>
            <span
              className={`block min-h-[11px] font-mono text-[8px] uppercase leading-none tracking-[0.14em] ${
                intent.tag ? 'text-command-watch' : 'text-transparent'
              }`}
            >
              {intent.tag || '-'}
            </span>
            <span className="line-clamp-2 font-mono text-[9px] leading-[1.35] text-ink-faint">
              {intent.description}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

const MORE_INTENT_IDS = ['property_basics']

const SECONDARY_INTENTS = {
  property_basics: {
    tag: 'Licensed',
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-live/60 bg-command-live/12',
    selectedMark: 'border-command-live bg-command-live/20 text-command-live',
  },
}

function OptionalAddonRow({
  id,
  label,
  description,
  selected,
  disabled,
  onToggle,
  stacked = false,
}) {
  const body = (
    <>
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white">
        {label}
      </span>
      <span className="mt-1.5 block font-mono text-[10px] leading-relaxed text-ink-faint">
        {description}
      </span>
    </>
  )

  const selectedClass =
    'border-command-watch/60 bg-command-watch/12'
  const idleClass =
    'border-panel-border bg-panel-surface/30 hover:border-[#333] hover:bg-panel-surface/50'

  if (stacked) {
    return (
      <label
        className={`workflow-package-card isolate block cursor-pointer rounded-lg border px-3.5 py-3 transition ${
          selected ? selectedClass : idleClass
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          disabled={disabled}
          onChange={() => onToggle?.(id)}
        />
        <span className="flex items-center gap-3">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
              selected
                ? 'border-command-watch bg-command-watch/20 text-command-watch'
                : 'border-white/25 bg-black/40'
            }`}
            aria-hidden
          >
            {selected ? <span className="font-mono text-[9px] leading-none">✓</span> : null}
          </span>
          <span className="min-w-0 flex-1">{body}</span>
        </span>
      </label>
    )
  }

  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 transition ${
        selected ? selectedClass : idleClass
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <input
        type="checkbox"
        className="shrink-0 self-center accent-command-watch"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle?.(id)}
      />
      <span className="min-w-0 flex-1">{body}</span>
    </label>
  )
}

function PackageSkeleton({ stacked = false }) {
  const cardClass = stacked
    ? 'workflow-package-card isolate w-full rounded-lg border border-panel-border/50 bg-panel-surface/20 px-3.5 py-3'
    : 'workflow-package-btn flex w-full items-center gap-3 rounded-md border border-panel-border/50 bg-panel-surface/20 px-3 py-2.5'

  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading packages">
      {[0, 1, 2].map(i => (
        <div key={i} className={cardClass}>
          <div className="flex items-start gap-3">
            <span className="checkout-skeleton-block h-4 w-4 shrink-0 rounded" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="checkout-skeleton-block block h-3 w-2/5 rounded" />
              <span className="checkout-skeleton-block block h-2.5 w-4/5 rounded" />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function IntentPackagePicker({
  presets,
  catalog,
  loading = false,
  activePresetId,
  selectedSources,
  onToggleSource,
  onApply,
  disabled,
  locationLocked = false,
  scheduleHasRows = false,
  scheduleMode = false,
  layout = 'sidebar',
}) {
  const isOverlay = layout === 'overlay'
  const isCompact = layout === 'compact'
  const isSidebar = layout === 'sidebar'
  const stacked = isSidebar || isCompact
  const keysConfigured = insuranceSourcesConfigured(catalog)
  const aiConfigured = openAiConfigured(catalog)
  const presetById = Object.fromEntries((presets ?? []).map(p => [p.id, p]))
  const webSearchSelected = selectedSources?.includes(WEB_SEARCH_SOURCE_ID)
  const visionSelected = selectedSources?.includes(VISION_SOURCE_ID)
  const showAddons = aiConfigured
  const hasLocationInput = locationLocked || scheduleHasRows
  const locationHint = scheduleMode
    ? 'Upload a schedule first, then choose packages and add-ons.'
    : 'Lock an address on the map first, then choose packages and add-ons.'

  if (loading || !presets?.length) {
    return <PackageSkeleton stacked={stacked} />
  }

  const allPackageItems = [
    { type: 'primary', intent: PRIMARY_INTENTS[0] },
    ...MORE_INTENT_IDS.map(id => ({ type: 'secondary', id })),
    { type: 'primary', intent: PRIMARY_INTENTS[1] },
  ]

  const controlsDisabled = disabled || !hasLocationInput

  return (
    <div
      className={`flex flex-col ${stacked ? 'gap-3' : 'gap-2'} ${isOverlay || stacked ? '' : 'h-full min-h-0 justify-center'} ${
        !hasLocationInput ? 'pointer-events-none opacity-40' : ''
      }`}
    >
      <ul className={`flex flex-col ${stacked ? 'gap-3' : 'gap-2'}`}>
        {allPackageItems.map(item => {
          if (item.type === 'primary') {
            const intent = item.intent
            const preset = presetById[intent.id]
            if (!preset) return null

            const selected = activePresetId === intent.id
            const warning =
              !hasLocationInput
                ? null
                : intent.premium && !keysConfigured
                  ? 'Unavailable'
                  : null

            return (
              <li key={intent.id}>
                <PackageButton
                  intent={intent}
                  selected={selected}
                  disabled={controlsDisabled}
                  warning={warning}
                  stacked={stacked}
                  onClick={() => onApply(intent.id)}
                />
              </li>
            )
          }

          const id = item.id
          const preset = presetById[id]
          const styles = SECONDARY_INTENTS[id]
          if (!preset || !styles) return null

          const selected = activePresetId === id
          return (
            <li key={id}>
              <PackageButton
                intent={{
                  ...styles,
                  title: preset.label,
                  description: preset.description,
                }}
                selected={selected}
                disabled={controlsDisabled}
                stacked={stacked}
                onClick={() => onApply(id)}
              />
            </li>
          )
        })}
      </ul>

      {hasLocationInput ? (
        <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
          Public API feeds are $0 at the vendor. Licensed APIs show pass-through premium on the
          receipt. Aggregation service covers orchestration, compute, and hosting.
        </p>
      ) : null}

      {showAddons ? (
        <div className={stacked ? 'flex flex-col gap-2 border-t border-panel-border/60 pt-3' : 'space-y-2 border-t border-panel-border/60 pt-2'}>
          <p className="side-panel-title mb-0">Add-ons</p>
          <OptionalAddonRow
            id={WEB_SEARCH_SOURCE_ID}
            label="Public records search"
            description={
              hasLocationInput
                ? 'Finds property details from assessor records, permits, and public listing pages.'
                : locationHint
            }
            selected={webSearchSelected}
            disabled={controlsDisabled}
            stacked={stacked}
            onToggle={onToggleSource}
          />
          <OptionalAddonRow
            id={VISION_SOURCE_ID}
            label="Image analysis"
            description={
              hasLocationInput
                ? 'AI estimates construction type and ISO class from satellite and Street View imagery.'
                : locationHint
            }
            selected={visionSelected}
            disabled={controlsDisabled}
            stacked={stacked}
            onToggle={onToggleSource}
          />
        </div>
      ) : (
        <p className="font-mono text-[9px] leading-snug text-ink-faint">
          Public records search and property imagery add-ons require server configuration.
        </p>
      )}
    </div>
  )
}
