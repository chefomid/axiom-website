import { useCallback, useEffect, useState } from 'react'

import { emailReportConfirmation } from '../../services/propertyApi'
import { formatBillingError, messageFromApiError } from '../../utils/apiErrors'

function formatEmailError(err) {
  if (err?.status === 502) {
    return 'We could not send that email right now. Please try again.'
  }
  if (err?.status === 503 || err?.status === 409) {
    return messageFromApiError(err, 'We could not send that email right now. Please try again.')
  }
  return formatBillingError(err, 'We could not send that email right now. Please try again.')
}

export const EMAIL_ACTION_BTN_CLASS =
  'rounded-md border border-command-watch/35 bg-command-watch/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-command-watch transition hover:border-command-watch/55 hover:bg-command-watch/18 disabled:border-panel-border disabled:bg-panel-surface/40 disabled:text-ink-muted disabled:opacity-60'

export default function EmailConfirmationButton({
  confirmationId,
  defaultReportName = '',
  className = EMAIL_ACTION_BTN_CLASS,
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [reportName, setReportName] = useState(defaultReportName)
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState(null)
  const [sentTo, setSentTo] = useState(null)

  useEffect(() => {
    if (open) setReportName(defaultReportName)
  }, [defaultReportName, open])

  const resetForm = useCallback(() => {
    setOpen(false)
    setEmail('')
    setReportName(defaultReportName)
    setPhase('idle')
    setError(null)
    setSentTo(null)
  }, [defaultReportName])

  const handleSend = useCallback(
    async event => {
      event.preventDefault()
      const trimmedEmail = email.trim()
      const trimmedName = reportName.trim()
      if (!trimmedEmail) {
        setError('Enter your email address.')
        return
      }
      setError(null)
      setPhase('sending')
      try {
        await emailReportConfirmation({
          confirmationId,
          email: trimmedEmail,
          reportName: trimmedName || undefined,
        })
        setSentTo(trimmedEmail)
        setPhase('sent')
      } catch (err) {
        setPhase('idle')
        setError(formatEmailError(err))
      }
    },
    [confirmationId, email, reportName],
  )

  if (!confirmationId?.trim()) return null

  if (phase === 'sent' && sentTo) {
    return (
      <p className="basis-full font-sans text-xs text-ink-secondary">
        Check your inbox at{' '}
        <span className="text-command-watch">{sentTo}</span>
        {' · '}
        <button
          type="button"
          onClick={resetForm}
          className="font-mono text-[10px] uppercase tracking-wide text-ink-muted underline decoration-ink-faint/40 underline-offset-2 hover:text-white"
        >
          Send again
        </button>
      </p>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Email confirmation number
      </button>
    )
  }

  return (
    <form onSubmit={handleSend} className="flex basis-full flex-col gap-2 pt-1">
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">Report name</span>
        <input
          type="text"
          value={reportName}
          onChange={event => setReportName(event.target.value)}
          placeholder="123 Main St, Austin, TX"
          autoComplete="off"
          disabled={phase === 'sending'}
          className="mt-1 w-full rounded border border-panel-border bg-black/40 px-3 py-1.5 font-sans text-sm text-white placeholder:text-ink-faint focus:border-command-watch/40 focus:outline-none disabled:opacity-60"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">Email</span>
        <input
          id={`email-confirmation-${confirmationId}`}
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          disabled={phase === 'sending'}
          className="mt-1 w-full rounded border border-panel-border bg-black/40 px-3 py-1.5 font-sans text-sm text-white placeholder:text-ink-faint focus:border-command-watch/40 focus:outline-none disabled:opacity-60"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={phase === 'sending'} className={className}>
          {phase === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={phase === 'sending'}
          className="rounded border border-panel-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted transition hover:text-white disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="font-sans text-xs text-command-critical">{error}</p> : null}
    </form>
  )
}
