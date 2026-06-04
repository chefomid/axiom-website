function formatRefreshTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function DataRangeSuffix({ dataRange }) {
  if (!dataRange) return null
  return <span className="text-ink-faint"> · {dataRange}</span>
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
        <DataRangeSuffix dataRange={feed.dataRange} />
      </span>
    )
  }

  if (feed.error && feed.stale) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-watch">
        {feed.sourceName}: stale · {feed.recordCount} record{feed.recordCount === 1 ? '' : 's'}
        <DataRangeSuffix dataRange={feed.dataRange} />
        <span className="text-ink-faint"> · synced {formatRefreshTime(feed.lastFetchedAt)}</span>
      </span>
    )
  }

  if (feed.error) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-command-critical">
        {feed.sourceName}: unavailable
        <DataRangeSuffix dataRange={feed.dataRange} />
      </span>
    )
  }

  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
      <span className="text-command-live">{feed.sourceName}</span>
      {': '}
      {feed.recordCount} record{feed.recordCount === 1 ? '' : 's'}
      <DataRangeSuffix dataRange={feed.dataRange} />
      <span className="text-ink-faint"> · synced {formatRefreshTime(feed.lastFetchedAt)}</span>
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
