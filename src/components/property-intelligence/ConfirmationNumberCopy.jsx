import { useCallback, useState } from 'react'

export default function ConfirmationNumberCopy({
  confirmationId,
  className = '',
  compact = false,
  tone = 'default',
}) {
  const [copied, setCopied] = useState(false)
  const id = confirmationId?.trim()
  if (!id) return null

  const isDossier = tone === 'dossier'
  const isDossierHeader = tone === 'dossierHeader'
  const copyBtnClass = isDossierHeader
    ? 'rounded border border-[#e8a838]/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#e8a838] transition hover:bg-[#e8a838]/15'
    : isDossier
      ? 'dossier-btn-ghost !px-2.5 !py-1'
      : 'rounded border border-panel-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary transition-colors hover:border-command-watch/40 hover:text-command-watch'

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [id])

  const idClass = isDossierHeader
    ? 'font-mono tabular-nums tracking-wide text-white'
    : isDossier
      ? 'font-mono tabular-nums tracking-wide dossier-value'
      : 'font-mono tabular-nums tracking-wide text-command-watch'
  const labelClass = isDossierHeader
    ? 'font-mono text-[9px] uppercase tracking-[0.14em] text-white'
    : isDossier
      ? 'font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted'
      : 'font-mono text-[9px] uppercase tracking-[0.14em] text-command-watch'

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span className={`${labelClass} mr-1`}>Analysis ID#</span>
        <span className={`${idClass} text-sm`}>{id}</span>
        <button type="button" onClick={() => void handleCopy()} className={copyBtnClass}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`${
        isDossier ? 'dossier-card' : 'rounded-md border border-command-watch/25 bg-command-watch/8'
      } px-3 py-2.5 ${className}`}
    >
      <p className={labelClass}>Analysis ID#</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className={`${idClass} text-base font-semibold`}>{id}</span>
        <button type="button" onClick={() => void handleCopy()} className={copyBtnClass}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p
        className={`mt-2 font-sans text-xs leading-relaxed ${
          isDossier ? 'text-ink-secondary' : 'text-ink-muted'
        }`}
      >
        Save this Analysis ID# so you can retrieve your report later with &quot;Retrieve with Analysis
        ID#&quot; on Property Intelligence.
      </p>
    </div>
  )
}
