export default function PropertySearchBar({
  address,
  sourceUrl,
  loading,
  onAddressChange,
  onSourceUrlChange,
  onSubmit,
  onClear,
}) {
  return (
    <form
      className="space-y-3 border-b border-panel-border p-4"
      onSubmit={e => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div>
        <label htmlFor="property-address" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Property address
        </label>
        <input
          id="property-address"
          type="text"
          value={address}
          onChange={e => onAddressChange(e.target.value)}
          placeholder="123 Main St, Portland, OR 97201"
          className="w-full rounded border border-panel-border bg-panel-surface px-3 py-2 font-mono text-sm text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/30"
          disabled={loading}
          autoComplete="street-address"
        />
      </div>
      <div>
        <label htmlFor="property-source-url" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Public source URL (optional)
        </label>
        <input
          id="property-source-url"
          type="url"
          value={sourceUrl}
          onChange={e => onSourceUrlChange(e.target.value)}
          placeholder="https://county-assessor.example.gov/parcel/…"
          className="w-full rounded border border-panel-border bg-panel-surface px-3 py-2 font-mono text-xs text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/30"
          disabled={loading}
        />
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
          Crawl4AI extracts readable content from public pages only. Respect site terms and robots.txt.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="rounded border border-command-live/40 bg-command-live/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-command-live transition hover:bg-command-live/20 disabled:opacity-40"
        >
          {loading ? 'Enriching…' : 'Enrich location'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted transition hover:text-white disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </form>
  )
}
