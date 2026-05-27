function formatRefreshTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function FeedStatusChip({ feed }) {
  if (!feed.enabled) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
        {feed.sourceName}: off
      </span>
    )
  }

  if (feed.loading) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-watch">
        {feed.sourceName}: syncing…
      </span>
    )
  }

  if (feed.error) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-critical">
        {feed.sourceName}: error
      </span>
    )
  }

  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
      <span className="text-command-live">{feed.sourceName}</span>
      {': '}
      {feed.recordCount} record{feed.recordCount === 1 ? '' : 's'}
      <span className="text-ink-faint"> · {formatRefreshTime(feed.lastFetchedAt)}</span>
    </span>
  )
}

export default function FeedStatusBar({ feeds }) {
  const activeFeeds = feeds.filter(f => f.enabled)
  if (!activeFeeds.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-panel-border px-4 py-2 md:px-6">
      {feeds.map(feed => (
        <FeedStatusChip key={feed.sourceName} feed={feed} />
      ))}
    </div>
  )
}
