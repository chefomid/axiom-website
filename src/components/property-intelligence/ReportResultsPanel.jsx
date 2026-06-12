import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { publicDataCommandAtLocation } from '../../constants/routes'
import { downloadReportPdf } from '../../services/reportApi'
import { buildCopeReportDocument, validateCopeReportDocument } from '../../utils/copeReportDocument'
import { downloadCopeExcel } from '../../utils/copeReportExcel'
import CopeSnapshot from './CopeSnapshot'
import ReportConflictsPanel from './ReportConflictsPanel'
import ReportHazardsPanel from './ReportHazardsPanel'
import ReportSourceFields from './ReportSourceFields'
import ReportSovPanel from './ReportSovPanel'
import ReportVisionPanel from './ReportVisionPanel'

const BASE_TABS = [
  { id: 'cope', label: 'COPE' },
  { id: 'sources', label: 'Sources' },
  { id: 'hazards', label: 'Hazards' },
  { id: 'conflicts', label: 'Conflicts' },
]
const IMAGE_TAB = { id: 'image', label: 'Image' }
const SOV_TAB = { id: 'sov', label: 'SOV' }

function LoadingState({ variant }) {
  return (
    <div
      className={
        variant === 'panel'
          ? 'flex flex-1 items-center justify-center px-6 py-12'
          : 'border-b border-panel-border px-4 py-3'
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span className="street-view-spinner h-3 w-3 shrink-0" aria-hidden />
        <span className="font-mono text-[10px] text-ink-secondary">Generating report…</span>
      </div>
    </div>
  )
}

function ErrorState({ error, apiOnline, variant }) {
  const isGeocodeMiss = /could not be geocoded/i.test(error)
  const isApiOffline = apiOnline === false || /failed to fetch|network/i.test(error)

  return (
    <div
      className={
        variant === 'panel'
          ? 'flex flex-1 flex-col justify-center px-6 py-8'
          : 'border-b border-command-critical/30 bg-command-critical/5 px-4 py-3'
      }
    >
      <p className="font-mono text-[10px] text-command-critical">{error}</p>
      {isGeocodeMiss ? (
        <p className="mt-2 font-mono text-[9px] text-ink-faint">
          Use a full street address with city, state, and ZIP.
        </p>
      ) : null}
      {isApiOffline ? (
        <p className="mt-2 font-mono text-[9px] text-ink-faint">
          Run <code className="text-ink-secondary">npm run property-api</code> in a separate terminal.
        </p>
      ) : null}
    </div>
  )
}

export default function ReportResultsPanel({ record, error, loading, apiOnline, variant = 'embedded' }) {
  const isPanel = variant === 'panel'
  const [open, setOpen] = useState(Boolean(record))
  const [activeTab, setActiveTab] = useState('cope')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    if (record) setOpen(true)
  }, [record])

  if (loading) {
    return <LoadingState variant={variant} />
  }

  if (error) {
    return <ErrorState error={error} apiOnline={apiOnline} variant={variant} />
  }

  if (!record) return null

  const hazardLink =
    record.lat != null && record.lng != null
      ? publicDataCommandAtLocation(record.lat, record.lng)
      : null

  const conflictCount = (record.conflicts ?? []).filter(c => c.alternatives?.length > 1).length
  let tabs = [...BASE_TABS]
  if (record.statement_of_values) tabs = [...tabs, SOV_TAB]
  if (record.vision_analysis) tabs = [...tabs, IMAGE_TAB]

  async function handleExportPdf() {
    setExportError(null)
    setExportingPdf(true)
    try {
      const doc = buildCopeReportDocument(record)
      const errors = validateCopeReportDocument(doc)
      if (errors.length) throw new Error(errors.join(' '))
      await downloadReportPdf(doc, record.display_name || record.address_input, { prefix: 'cope-report' })
    } catch (err) {
      setExportError(err?.message ?? 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleExportExcel() {
    setExportError(null)
    setExportingExcel(true)
    try {
      const doc = buildCopeReportDocument(record)
      const errors = validateCopeReportDocument(doc)
      if (errors.length) throw new Error(errors.join(' '))
      await downloadCopeExcel(doc, record.display_name || record.address_input, { prefix: 'cope-report' })
    } catch (err) {
      setExportError(err?.message ?? 'Excel export failed')
    } finally {
      setExportingExcel(false)
    }
  }

  const reportBody = (
    <>
      <div className="border-b border-panel-border/60 px-5 py-3">
        {record.report_id ? (
          <p className="font-mono text-[10px] tabular-nums text-ink-muted">{record.report_id}</p>
        ) : null}
        {hazardLink ? (
          <Link
            to={hazardLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 font-sans text-xs text-command-live transition hover:underline ${record.report_id ? 'mt-2' : ''}`}
          >
            Live hazards at this location
            <span className="font-mono text-[10px] text-ink-faint" aria-hidden>
              ↗
            </span>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-panel-border/60 px-5 py-3">
        {record.cope?.sections?.length ? (
          <>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || exportingExcel}
              className="rounded-md border border-command-live/50 bg-command-live/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-command-live transition hover:bg-command-live/25 disabled:opacity-40"
            >
              {exportingPdf ? 'Exporting…' : 'Export COPE PDF'}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingPdf || exportingExcel}
              className="rounded-md border border-panel-border bg-panel-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-primary transition hover:border-command-live/40 hover:bg-panel-surface disabled:opacity-40"
            >
              {exportingExcel ? 'Exporting…' : 'Export COPE Excel'}
            </button>
          </>
        ) : null}
        {exportError ? (
          <span className="font-sans text-xs text-command-critical">{exportError}</span>
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-1.5 border-b border-panel-border/60 px-5 py-3"
        role="tablist"
        aria-label="Report result views"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition ${
              activeTab === tab.id
                ? 'border-command-live/60 bg-command-live/15 text-white shadow-[inset_0_0_0_1px_rgba(74,158,255,0.15)]'
                : 'border-panel-border bg-panel-surface/40 text-ink-muted hover:border-command-live/30 hover:text-ink-secondary'
            }`}
          >
            {tab.label}
            {tab.id === 'conflicts' && conflictCount > 0 ? (
              <span className="ml-1 rounded bg-command-watch/15 px-1 text-command-watch">({conflictCount})</span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        className={
          isPanel
            ? 'min-h-0 flex-1 overflow-y-auto sleek-scrollbar'
            : 'max-h-[min(50vh,420px)] overflow-y-auto sleek-scrollbar'
        }
      >
        {activeTab === 'cope' ? <CopeSnapshot cope={record.cope} conflicts={[]} /> : null}
        {activeTab === 'sources' ? (
          <ReportSourceFields
            fields={record.fields}
            crawlExcerpt={record.crawl_markdown_excerpt}
            crawlSourceUrl={record.crawl_source_url}
          />
        ) : null}
        {activeTab === 'hazards' ? <ReportHazardsPanel hazards={record.hazards} /> : null}
        {activeTab === 'conflicts' ? (
          <ReportConflictsPanel conflicts={record.conflicts} cope={record.cope} />
        ) : null}
        {activeTab === 'sov' ? (
          <ReportSovPanel
            statementOfValues={record.statement_of_values}
            sovDigestMd={record.sov_digest_md}
            sovAnalysis={record.sov_analysis}
          />
        ) : null}
        {activeTab === 'image' ? (
          <ReportVisionPanel visionAnalysis={record.vision_analysis} />
        ) : null}
      </div>
    </>
  )

  const statusTone =
    record.status === 'complete'
      ? 'text-command-stable'
      : record.status === 'partial'
        ? 'text-command-watch'
        : 'text-ink-secondary'

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-panel-bg">
        <div className="shrink-0 border-b border-panel-border bg-panel-surface/20 px-5 py-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Report results</p>
          <p className={`mt-1.5 font-display text-lg font-semibold capitalize ${statusTone}`}>{record.status}</p>
          {record.display_name ? (
            <p className="mt-2 font-sans text-sm leading-relaxed text-ink-primary">{record.display_name}</p>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{reportBody}</div>
      </div>
    )
  }

  return (
    <div className="border-b border-panel-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-panel-surface/30"
      >
        <span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Report results</span>
          <span className={`mt-1 block font-display text-sm font-semibold capitalize ${statusTone}`}>
            {record.status}
          </span>
        </span>
        <span className="font-mono text-sm text-ink-faint">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-panel-border/60">{reportBody}</div> : null}
    </div>
  )
}
