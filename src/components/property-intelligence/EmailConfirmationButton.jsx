import { useCallback, useEffect, useState } from 'react'

import { CONTACT_EMAIL } from '../../constants/site'
import { emailReportConfirmation } from '../../services/propertyApi'
import { markConfirmationEmailSent } from '../../utils/confirmationEmailSent'
import { formatBillingError, messageFromApiError } from '../../utils/apiErrors'

function formatEmailError(err) {
  if (err?.name === 'AbortError' || /aborted|timeout/i.test(err?.message ?? '')) {
    return 'The request timed out. Check your connection and try again.'
  }
  if (err?.status === 503) {
    const msg = messageFromApiError(err, '')
    if (/not available|not configured/i.test(msg)) {
      return `Email delivery is not available yet. Save your confirmation number, or contact ${CONTACT_EMAIL}.`
    }
    return msg || `Email delivery is not available yet. Contact ${CONTACT_EMAIL}.`
  }
  if (err?.status === 502) {
    return `We could not send that email. Try again in a moment, or contact ${CONTACT_EMAIL}.`
  }
  if (err?.status === 409) {
    return messageFromApiError(err, 'Report is still being prepared.')
  }
  if (err?.status === 404) {
    return 'This confirmation number is not ready for email yet. Save the number shown above.'
  }
  return formatBillingError(err, `We could not send that email. Contact ${CONTACT_EMAIL}.`)
}

export const EMAIL_ACTION_BTN_CLASS =
  'rounded-md border border-command-watch/35 bg-command-watch/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-command-watch transition hover:border-command-watch/55 hover:bg-command-watch/18 disabled:border-panel-border disabled:bg-panel-surface/40 disabled:text-ink-muted disabled:opacity-60'

export default function EmailConfirmationButton({
  confirmationId,
  defaultReportName = '',
  className = EMAIL_ACTION_BTN_CLASS,
  open: controlledOpen,
  onOpenChange,
  onSent,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

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
  }, [defaultReportName, setOpen])

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
        markConfirmationEmailSent(confirmationId)
        setSentTo(trimmedEmail)
        setPhase('sent')
        onSent?.()
      } catch (err) {
        setPhase('idle')
        setError(formatEmailError(err))
      }
    },
    [confirmationId, email, onSent, reportName],
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
      {phase === 'sending' ? (
        <p className="font-sans text-xs text-ink-muted">Sending from {CONTACT_EMAIL}…</p>
      ) : null}
      {error ? <p className="font-sans text-xs text-command-critical">{error}</p> : null}
    </form>
  )
}
