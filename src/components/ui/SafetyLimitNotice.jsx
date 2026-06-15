export default function SafetyLimitNotice({
  title,
  safetyNote,
  tone = 'watch',
  className = '',
  onDismiss,
}) {
  const shell =
    tone === 'critical'
      ? 'border-command-critical/30 bg-command-critical/5'
      : 'border-command-watch/30 bg-command-watch/10'
  const titleClass =
    tone === 'critical' ? 'text-command-critical' : 'text-command-watch'

  return (
    <div className={`rounded border px-3 py-2 ${shell} ${className}`.trim()}>
      <p className={`font-mono text-[9px] leading-snug ${titleClass}`}>{title}</p>
      {safetyNote ? (
        <p className="mt-1 font-mono text-[8px] leading-snug text-ink-faint">{safetyNote}</p>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-1 font-mono text-[8px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  )
}

export const FAIR_USAGE_FOOTER =
  'Fair usage limits may apply to protect service quality.'
