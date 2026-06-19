import { useCallback, useState } from 'react'

const COPY_BTN_CLASS =
  'rounded border border-panel-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:border-command-watch/40 hover:text-command-watch'

export default function ConfirmationNumberCopy({ confirmationId, className = '', compact = false }) {
  const [copied, setCopied] = useState(false)
  const id = confirmationId?.trim()
  if (!id) return null

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [id])

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className="font-mono text-sm tabular-nums tracking-wide text-command-watch">{id}</span>
        <button type="button" onClick={() => void handleCopy()} className={COPY_BTN_CLASS}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`rounded-md border border-command-watch/25 bg-command-watch/8 px-3 py-2.5 ${className}`}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">Confirmation number</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm tabular-nums tracking-wide text-command-watch">{id}</span>
        <button type="button" onClick={() => void handleCopy()} className={COPY_BTN_CLASS}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 font-sans text-xs leading-relaxed text-ink-muted">
        Save this number somewhere safe so you can retrieve your report later with &quot;Retrieve with
        confirmation number&quot; on Property Intelligence.
      </p>
    </div>
  )
}
