const TIER_STYLES = {
  free: 'border-panel-border text-ink-faint',
  osint: 'border-command-live/30 text-command-live',
  standard: 'border-ink-muted/40 text-ink-secondary',
  insurance: 'border-amber-500/50 text-amber-200',
  service: 'border-panel-border text-ink-muted',
}

const TIER_LABELS = {
  free: 'Public',
  osint: 'OSINT',
  standard: 'Standard',
  insurance: 'Licensed',
  service: 'Service',
}

export default function SourceTierBadge({ tier, badge, featured }) {
  if (badge) {
    return (
      <span className="shrink-0 rounded border border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-200">
        {badge}
      </span>
    )
  }
  if (!tier) return null
  const cls = TIER_STYLES[tier] ?? TIER_STYLES.free
  const label = featured && tier === 'insurance' ? 'Licensed' : TIER_LABELS[tier] ?? tier
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  )
}

export function tierSortOrder(tier) {
  const order = { insurance: 0, standard: 1, osint: 2, free: 3, service: 4 }
  return order[tier] ?? 5
}
