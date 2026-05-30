import { useEffect, useMemo, useState } from 'react'
import {
  formatFeedError,
  formatRetryCountdown,
} from '../../utils/feedErrors'

export default function FeedErrorBanner({ source, message, retryAt }) {
  const formatted = useMemo(
    () => formatFeedError(source, message, retryAt),
    [source, message, retryAt],
  )

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (formatted.retryAt == null) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [formatted.retryAt])

  const countdown =
    formatted.retryAt != null ? formatRetryCountdown(formatted.retryAt, now) : null
  const retryReady = formatted.retryAt != null && formatted.retryAt <= now

  return (
    <div className="rounded border border-command-critical/40 bg-[#0d0d0d]/90 px-2.5 py-2 backdrop-blur-sm">
      <p className="font-mono text-[10px] font-medium text-command-critical">{formatted.title}</p>
      <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-muted">{formatted.detail}</p>
      {formatted.retryAt != null && (
        <p className="mt-1.5 font-mono text-[9px] text-command-watch">
          {retryReady ? 'Retrying now…' : `Retrying in ${countdown}`}
        </p>
      )}
    </div>
  )
}
