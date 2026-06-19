export default function EmailConfirmationCloseModal({
  open,
  confirmationId,
  onSendEmail,
  onCloseAnyway,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-close-prompt-title"
        className="w-full max-w-md rounded-lg border border-panel-border bg-[#0a0a0a] px-5 py-6 shadow-2xl"
      >
        <p id="email-close-prompt-title" className="font-display text-lg font-semibold text-white">
          Email your confirmation number?
        </p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
          Save{' '}
          <span className="font-mono text-command-watch">{confirmationId}</span> to your inbox so you can
          retrieve this report later.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCloseAnyway}
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:border-[#444] hover:text-white"
          >
            Close without emailing
          </button>
          <button
            type="button"
            onClick={onSendEmail}
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-command-watch/40 bg-command-watch/12 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-command-watch transition-colors hover:border-command-watch/60 hover:bg-command-watch/18"
          >
            Send email
          </button>
        </div>
      </div>
    </div>
  )
}
