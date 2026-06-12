const DOT = {
  stable: 'bg-[#187a3f] shadow-[0_0_5px_rgba(24,122,63,0.55)]',
  live: 'bg-command-live',
  watch: 'bg-command-watch',
  critical: 'bg-command-critical',
}

export default function StatusChip({ label, status = 'stable', pulse = false, size = 'sm' }) {
  const sizeClass =
    size === 'md'
      ? 'h-8 gap-1.5 px-3 text-[9px] tracking-[0.12em]'
      : 'h-6 gap-2 px-2.5 text-[10px] tracking-[0.18em]'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-panel-border bg-panel-surface/35 font-mono leading-none uppercase text-ink-muted ${sizeClass}`}
    >
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
