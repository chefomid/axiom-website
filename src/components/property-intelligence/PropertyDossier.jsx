import { Link } from 'react-router-dom'
import { publicDataCommandAtLocation } from '../../constants/routes'

const CONFIDENCE_CLASS = {
  high: 'text-command-stable',
  medium: 'text-command-watch',
  low: 'text-ink-faint',
}

export default function PropertyDossier({ record, error, loading, apiOnline }) {
  if (loading) {
    return (
      <div className="p-4 font-mono text-xs text-ink-muted">
        Geocoding address and running extraction…
      </div>
    )
  }

  if (error) {
    const isGeocodeMiss = /could not be geocoded/i.test(error)
    const isApiOffline = apiOnline === false || /failed to fetch|network/i.test(error)

    return (
      <div className="border-l-2 border-command-critical p-4">
        <p className="font-mono text-xs text-command-critical">{error}</p>
        {isGeocodeMiss ? (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
            Use a complete street address with city, state, and ZIP. Example:{' '}
            <span className="text-ink-secondary">123 Main St, Portland, OR 97201</span>
          </p>
        ) : null}
        {isApiOffline ? (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
            Start the API: <code className="text-ink-secondary">npm run property-api</code> from the project
            root (separate terminal from <code className="text-ink-secondary">npm run dev</code>).
          </p>
        ) : null}
      </div>
    )
  }

  if (!record) {
    return (
      <div className="p-4">
        <p className="font-display text-sm text-white">Property dossier</p>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-muted">
          Enter an address to geocode and build a structured property record. Optionally add a public assessor or permit URL for Crawl4AI extraction.
        </p>
      </div>
    )
  }

  const hazardLink =
    record.lat != null && record.lng != null
      ? publicDataCommandAtLocation(record.lat, record.lng)
      : null

  return (
    <div className="sleek-scrollbar flex max-h-full flex-col overflow-y-auto">
      <div className="border-b border-panel-border p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Status</p>
        <p className="mt-1 font-display text-sm text-white capitalize">{record.status}</p>
        {record.message ? (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-secondary">{record.message}</p>
        ) : null}
        {hazardLink ? (
          <Link
            to={hazardLink}
            className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-command-live hover:underline"
          >
            View live hazards at this location →
          </Link>
        ) : null}
      </div>

      {record.display_name ? (
        <div className="border-b border-panel-border p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Resolved address</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-white">{record.display_name}</p>
          {record.lat != null && record.lng != null ? (
            <p className="mt-2 font-mono text-[10px] tabular-nums text-ink-faint">
              {record.lat.toFixed(5)}, {record.lng.toFixed(5)}
            </p>
          ) : null}
        </div>
      ) : null}

      {record.fields?.length > 0 ? (
        <div className="border-b border-panel-border p-4">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Structured fields</p>
          <ul className="space-y-2">
            {record.fields.map((f, i) => (
              <li key={`${f.key}-${i}`} className="rounded border border-panel-border bg-panel-surface/60 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{f.key}</span>
                  <span className={`font-mono text-[9px] uppercase ${CONFIDENCE_CLASS[f.confidence] ?? 'text-ink-faint'}`}>
                    {f.confidence}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-white">{f.value}</p>
                <p className="mt-0.5 font-mono text-[9px] text-ink-faint">source: {f.source}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {record.crawl_source_url ? (
        <div className="border-b border-panel-border p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Crawl source</p>
          <a
            href={record.crawl_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-[10px] text-command-live hover:underline"
          >
            {record.crawl_source_url}
          </a>
        </div>
      ) : null}

      {record.crawl_markdown_excerpt ? (
        <div className="p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Crawl excerpt (markdown)</p>
          <pre className="max-h-48 overflow-auto rounded border border-panel-border bg-[#0b0b0b] p-2 font-mono text-[9px] leading-relaxed text-ink-secondary">
            {record.crawl_markdown_excerpt.slice(0, 2000)}
            {record.crawl_markdown_excerpt.length > 2000 ? '\n…' : ''}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
