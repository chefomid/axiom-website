import { groupSourcesByCategory, formatVendorApiCost } from '../../services/propertyApi'
import SourceTierBadge, { tierSortOrder } from './SourceTierBadge'

function sortSources(sources) {
  return [...sources].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return tierSortOrder(a.tier) - tierSortOrder(b.tier)
  })
}

export default function SourceCatalog({
  catalog,
  selectedSources,
  onToggle,
  disabled,
  quote,
  vendors,
}) {
  if (!catalog) {
    return (
      <div className="p-4 font-mono text-[10px] text-ink-muted">Loading source catalog…</div>
    )
  }

  const groups = groupSourcesByCategory(catalog)
  const unavailable = new Set(
    (quote?.line_items ?? []).filter(i => i.available === false).map(i => i.source_id),
  )
  const unconfigured = new Set(
    (quote?.line_items ?? []).filter(i => i.configured === false && i.requires_api_key).map(i => i.source_id),
  )

  return (
    <div className="flex flex-col">
      {groups.map(group => {
        const isInsurance = group.id === 'property_insurance'
        return (
          <div key={group.id} className="border-b border-panel-border">
            <div
              className={`px-4 py-2 ${
                isInsurance ? 'border-b border-command-stable/15 bg-command-stable/5' : 'bg-panel-surface/40'
              }`}
            >
              <p
                className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
                  isInsurance ? 'text-command-stable/90' : 'text-ink-muted'
                }`}
              >
                {group.label}
              </p>
              {group.description ? (
                <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{group.description}</p>
              ) : null}
            </div>
            <ul className="divide-y divide-panel-border/50">
              {sortSources(group.sources).map(src => {
                const checked = selectedSources.includes(src.id)
                const dimmed = unavailable.has(src.id)
                const needsKey =
                  unconfigured.has(src.id) ||
                  (src.requires_api_key && src.configured === false)
                const vendor = src.vendor ? vendors?.[src.vendor] : null
                const isPremium = src.tier === 'insurance'

                return (
                  <li key={src.id}>
                    <label
                      className={`flex cursor-pointer gap-3 px-4 py-2.5 transition hover:bg-panel-surface/40 ${
                        dimmed ? 'opacity-50' : ''
                      } ${disabled ? 'pointer-events-none opacity-60' : ''} ${
                        isPremium && checked ? 'bg-command-stable/5' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || dimmed}
                        onChange={() => onToggle(src.id)}
                        className="mt-0.5 shrink-0 accent-[#4a9eff]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] text-white">{src.label}</span>
                          <SourceTierBadge tier={src.tier} badge={src.badge} featured={src.featured} />
                          <span className="ml-auto flex shrink-0 items-center gap-2">
                            <span className="font-mono text-[9px] tabular-nums text-ink-faint">
                              {formatVendorApiCost(src)}
                            </span>
                            <span
                              className={`rounded border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                                checked
                                  ? 'border-command-stable/60 bg-command-stable/10 text-command-stable'
                                  : 'border-panel-border bg-black/30 text-ink-faint'
                              }`}
                              aria-hidden
                            >
                              {checked ? 'On' : 'Off'}
                            </span>
                          </span>
                        </span>
                        {vendor ? (
                          <span className="mt-0.5 block font-mono text-[9px] text-ink-faint">{vendor.name}</span>
                        ) : null}
                        <span className="mt-0.5 block font-mono text-[9px] leading-relaxed text-ink-faint">
                          {src.description}
                        </span>
                        {src.marketing_note && (checked || isPremium) ? (
                          <span className="mt-1 block font-mono text-[9px] leading-relaxed text-ink-muted">
                            {src.marketing_note}
                          </span>
                        ) : null}
                        {needsKey ? (
                          <span className="mt-1 block font-mono text-[9px] text-ink-faint">
                            {checked ? 'Unavailable, skipped on generate' : 'Unavailable'}
                          </span>
                        ) : null}
                        {src.needs_source_url && checked ? (
                          <span className="mt-1 block font-mono text-[9px] text-command-live">
                            Public record pages resolve automatically on generate
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
