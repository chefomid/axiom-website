import {
  insuranceSourcesConfigured,
  openAiConfigured,
  formatUsd,
  quoteLineItem,
  estimateSourceUserPrice,
} from '../../services/propertyApi'

const WEB_SEARCH_SOURCE_ID = 'web_property_research'
const VISION_SOURCE_ID = 'vision_construction'

const PRIMARY_INTENTS = [
  {
    id: 'publicly_available',
    title: 'Publicly available',
    description: 'Free public records, hazards, COPE map',
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-live/50 bg-command-live/12 ring-1 ring-command-live/25',
    selectedMark: 'border-command-live bg-command-live/20 text-command-live',
  },
  {
    id: 'cope_insurance',
    title: 'Property dossier',
    description: 'Licensed ATTOM data, hazards, PDF export',
    tag: 'Carrier-grade',
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-stable/50 bg-command-stable/12 ring-1 ring-command-stable/25',
    selectedMark: 'border-command-stable bg-command-stable/20 text-command-stable',
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
        className={`workflow-package-card w-full rounded-lg border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
          selected ? intent.active : intent.accent
        }`}
      >
        <div className="flex items-start gap-3">
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

const MORE_INTENT_IDS = ['property_basics', 'vendor_comparison']

const SECONDARY_INTENTS = {
  property_basics: {
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-live/50 bg-command-live/12 ring-1 ring-command-live/25',
    selectedMark: 'border-command-live bg-command-live/20 text-command-live',
  },
  vendor_comparison: {
    accent:
      'border-panel-border bg-panel-surface/40 hover:border-[#333] hover:bg-panel-surface/60 active:scale-[0.99]',
    active: 'border-command-stable/50 bg-command-stable/12 ring-1 ring-command-stable/25',
    selectedMark: 'border-command-stable bg-command-stable/20 text-command-stable',
  },
}

function OptionalAddonRow({
  id,
  label,
  description,
  selected,
  priceLabel,
  loadingQuote,
  disabled,
  onToggle,
  stacked = false,
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-white">
          {label}
        </span>
        {priceLabel ? (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-command-stable">
            {loadingQuote && selected ? '…' : priceLabel}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block font-mono text-[10px] leading-relaxed text-ink-faint">
        {description}
        {selected ? ' Included in estimated total.' : ' Optional add-on.'}
      </span>
    </>
  )

  if (stacked) {
    return (
      <label
        className={`workflow-package-card cursor-pointer rounded-lg border px-3.5 py-3 transition ${
          selected
            ? 'border-command-stable/50 bg-command-stable/12 ring-1 ring-command-stable/25'
            : 'border-panel-border bg-panel-surface/30 hover:border-[#333] hover:bg-panel-surface/50'
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={selected}
          disabled={disabled}
          onChange={() => onToggle?.(id)}
        />
        <span className="flex items-start gap-3">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
              selected
                ? 'border-command-stable bg-command-stable/20 text-command-stable'
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
        selected
          ? 'border-command-stable/50 bg-command-stable/12 ring-1 ring-command-stable/25'
          : 'border-panel-border bg-panel-surface/30 hover:border-[#333] hover:bg-panel-surface/50'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <input
        type="checkbox"
        className="accent-command-stable"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle?.(id)}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-white">
            {label}
          </span>
          {priceLabel ? (
            <span className="shrink-0 font-mono text-xs tabular-nums text-command-stable">
              {loadingQuote && selected ? '…' : priceLabel}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block font-mono text-[9px] leading-snug text-ink-faint line-clamp-1">
          {description}
          {selected ? ' Included in estimated total below.' : ' Optional add-on.'}
        </span>
      </span>
    </label>
  )
}

export default function IntentPackagePicker({
  presets,
  catalog,
  activePresetId,
  selectedSources,
  quote,
  loadingQuote,
  onToggleSource,
  onApply,
  disabled,
  locationLocked = false,
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
  const showWebSearchOption = activePresetId === 'cope_insurance' && aiConfigured
  const showVisionOption = aiConfigured && locationLocked

  const webSearchCatalogSource = catalog?.sources?.find(s => s.id === WEB_SEARCH_SOURCE_ID)
  const visionCatalogSource = catalog?.sources?.find(s => s.id === VISION_SOURCE_ID)
  const webSearchQuoteLine = quoteLineItem(catalog, quote, WEB_SEARCH_SOURCE_ID)
  const visionQuoteLine = quoteLineItem(catalog, quote, VISION_SOURCE_ID)

  const webSearchEstimate =
    webSearchQuoteLine?.user_price_usd ?? estimateSourceUserPrice(webSearchCatalogSource, catalog)
  const visionEstimate =
    visionQuoteLine?.user_price_usd ?? estimateSourceUserPrice(visionCatalogSource, catalog)

  const webSearchPriceLabel =
    webSearchSelected && webSearchQuoteLine?.user_price_usd != null
      ? formatUsd(webSearchQuoteLine.user_price_usd)
      : webSearchEstimate != null
        ? `+${formatUsd(webSearchEstimate)}`
        : null

  const visionPriceLabel =
    visionSelected && visionQuoteLine?.user_price_usd != null
      ? formatUsd(visionQuoteLine.user_price_usd)
      : visionEstimate != null
        ? `+${formatUsd(visionEstimate)}`
        : null

  if (!presets?.length) {
    return <p className="font-mono text-[10px] text-ink-muted">Loading packages…</p>
  }

  // Least premium first: free → paid tiers → carrier-grade preset; add-ons render below.
  const allPackageItems = [
    { type: 'primary', intent: PRIMARY_INTENTS[0] },
    ...MORE_INTENT_IDS.map(id => ({ type: 'secondary', id })),
    { type: 'primary', intent: PRIMARY_INTENTS[1] },
  ]

  return (
    <div className={`flex flex-col ${stacked ? 'gap-3' : 'gap-2'} ${isOverlay || stacked ? '' : 'h-full min-h-0 justify-center'}`}>
      <ul className={`flex flex-col ${stacked ? 'gap-3' : 'gap-2'}`}>
        {allPackageItems.map(item => {
          if (item.type === 'primary') {
          const intent = item.intent
          const preset = presetById[intent.id]
          if (!preset) return null
          const selected = activePresetId === intent.id
          const warning = intent.premium && !keysConfigured ? 'Unavailable' : null

          return (
            <li key={intent.id}>
              <PackageButton
                intent={intent}
                selected={selected}
                disabled={disabled}
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
                disabled={disabled}
                stacked={stacked}
                onClick={() => onApply(id)}
              />
            </li>
          )
        })}
      </ul>

      {showWebSearchOption ? (
        <OptionalAddonRow
          id={WEB_SEARCH_SOURCE_ID}
          label="Add web search"
          description="OpenAI searches public assessor, permit, and listing pages for COPE fields beyond ATTOM."
          selected={webSearchSelected}
          priceLabel={webSearchPriceLabel}
          loadingQuote={loadingQuote}
          disabled={disabled}
          stacked={stacked}
          onToggle={onToggleSource}
        />
      ) : activePresetId === 'cope_insurance' && !aiConfigured ? (
        <p className="font-mono text-[9px] leading-snug text-ink-faint">
          Web search add-on is not available yet.
        </p>
      ) : null}

      {showVisionOption ? (
        <OptionalAddonRow
          id={VISION_SOURCE_ID}
          label="Add image analysis"
          description="AI estimates construction type and ISO class from satellite and Street View imagery."
          selected={visionSelected}
          priceLabel={visionPriceLabel}
          loadingQuote={loadingQuote}
          disabled={disabled}
          stacked={stacked}
          onToggle={onToggleSource}
        />
      ) : !aiConfigured ? (
        <p className="font-mono text-[9px] leading-snug text-ink-faint">
          Image analysis add-on is not available yet.
        </p>
      ) : !locationLocked && !isOverlay ? (
        <p className="font-mono text-[9px] leading-snug text-ink-faint">
          Lock an address on the map to enable image analysis.
        </p>
      ) : null}

    </div>
  )
}
