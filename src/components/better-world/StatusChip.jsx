const DOT = {
  stable: 'bg-command-stable',
  live: 'bg-command-live',
  watch: 'bg-command-watch',
  critical: 'bg-command-critical',
}

export default function StatusChip({ label, status = 'stable', pulse = false }) {
  return (
    <span className="inline-flex h-6 items-center gap-2 rounded-md border border-panel-border bg-panel-surface/35 px-2.5 font-mono text-[10px] leading-none tracking-[0.18em] uppercase text-ink-muted">
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${DOT[status]}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      </span>
      {label}
    </span>
  )
}
