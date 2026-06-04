import { useMemo } from 'react'

function Badge({ tone = 'neutral', children }) {
  const cls = useMemo(() => {
    if (tone === 'warning') {
      return 'border-command-watch/40 bg-command-watch/10 text-command-watch'
    }
    if (tone === 'live') {
      return 'border-command-live/40 bg-command-live/10 text-command-live'
    }
    if (tone === 'stable') {
      return 'border-command-stable/40 bg-command-stable/10 text-command-stable'
    }
    return 'border-panel-border bg-panel-surface/40 text-ink-secondary'
  }, [tone])

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  )
}

export default function AdvancedDrawer({
  open,
  onToggle,
  badges = [],
  title = 'Advanced',
  subtitle,
  children,
}) {
  return (
    <div className="border-b border-panel-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-panel-surface/30"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block font-mono text-[10px] text-ink-secondary">
              {subtitle}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {badges
            .filter(b => b?.label)
            .slice(0, 3)
            .map(b => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          <span className="font-mono text-[10px] text-ink-faint" aria-hidden>
            {open ? '−' : '+'}
          </span>
        </span>
      </button>

      {open ? (
        <div className="max-h-[min(52vh,520px)] overflow-y-auto sleek-scrollbar border-t border-panel-border/60">
          {children}
        </div>
      ) : null}
    </div>
  )
}

