import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isPublicDataCommandEnabled } from '../../config/features'
import { publicDataCommandAtLocation } from '../../constants/routes'
import { downloadReportPdf } from '../../services/reportApi'
import { buildCopeReportDocument, validateCopeReportDocument } from '../../utils/copeReportDocument'
import { downloadCopeExcel } from '../../utils/copeReportExcel'
import CopeSnapshot from './CopeSnapshot'
import ReportHazardsPanel from './ReportHazardsPanel'
import ReportSourceFields from './ReportSourceFields'
import ReportSovPanel from './ReportSovPanel'
import ReportVisionPanel from './ReportVisionPanel'

const BASE_TABS = [
  { id: 'cope', label: 'COPE' },
  { id: 'sources', label: 'Sources' },
  { id: 'hazards', label: 'Hazards' },
]
const IMAGE_TAB = { id: 'image', label: 'Image' }
const SOV_TAB = { id: 'sov', label: 'SOV' }

const TAB_ACTIVE_CLASS =
  'border-white bg-white text-black shadow-none'
const TAB_INACTIVE_CLASS =
  'border-panel-border bg-panel-surface/40 text-ink-muted hover:border-ink-muted hover:text-ink-secondary'
const ACTION_BTN_CLASS =
  'rounded-md border border-white bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-black transition hover:bg-[#e8e8e8] disabled:border-panel-border disabled:bg-panel-surface/40 disabled:text-ink-muted disabled:opacity-60'
const HAZARD_LINK_CLASS =
  'inline-flex items-center gap-1 font-sans text-xs text-white transition hover:underline'

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
  const [title, ...rest] = String(error ?? '').split('\n')
  const safetyNote = rest.filter(Boolean).join(' ')

  return (
    <div
      className={
        variant === 'panel'
          ? 'flex flex-1 flex-col justify-center px-6 py-8'
          : 'border-b border-command-critical/30 bg-command-critical/5 px-4 py-3'
      }
    >
      <p className="font-mono text-[10px] text-command-critical">{title}</p>
      {safetyNote ? (
        <p className="mt-1 font-mono text-[9px] text-ink-faint">{safetyNote}</p>
      ) : null}
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

export default function ReportResultsPanel({
  record,
  error,
  loading,
  apiOnline,
  variant = 'embedded',
  expanded = false,
  onToggleExpand,
  onClose,
  showHeader = true,
}) {
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
  const publicDataCommandEnabled = isPublicDataCommandEnabled()

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
          publicDataCommandEnabled ? (
            <Link
              to={hazardLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${HAZARD_LINK_CLASS} ${record.report_id ? 'mt-2' : ''}`}
            >
              Live hazards at this location
              <span className="font-mono text-[10px] text-ink-muted" aria-hidden>
                ↗
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('hazards')}
              className={`${HAZARD_LINK_CLASS} ${record.report_id ? 'mt-2' : ''}`}
            >
              View hazards for this location
            </button>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-panel-border/60 px-5 py-3">
        {record.cope?.sections?.length ? (
          <>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || exportingExcel}
              className={ACTION_BTN_CLASS}
            >
              {exportingPdf ? 'Exporting…' : 'Export COPE PDF'}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingPdf || exportingExcel}
              className={ACTION_BTN_CLASS}
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
        className="flex gap-1.5 overflow-x-auto border-b border-panel-border/60 px-5 py-3 sleek-scrollbar"
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
            className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide transition ${
              activeTab === tab.id ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
            }`}
          >
            {tab.label}
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
        {activeTab === 'cope' ? <CopeSnapshot cope={record.cope} /> : null}
        {activeTab === 'sources' ? (
          <ReportSourceFields
            fields={record.fields}
            crawlExcerpt={record.crawl_markdown_excerpt}
            crawlSourceUrl={record.crawl_source_url}
          />
        ) : null}
        {activeTab === 'hazards' ? <ReportHazardsPanel hazards={record.hazards} /> : null}
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
        {showHeader ? (
          <div className="shrink-0 border-b border-panel-border bg-panel-surface/20 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Report results</p>
                <p className={`mt-1 font-display text-lg font-semibold capitalize ${statusTone}`}>{record.status}</p>
                {record.display_name ? (
                  <p className="mt-1.5 font-sans text-sm leading-relaxed text-ink-primary">{record.display_name}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {onToggleExpand ? (
                  <button
                    type="button"
                    onClick={onToggleExpand}
                    className="rounded border border-panel-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted transition hover:border-command-live/40 hover:text-white"
                    title={expanded ? 'Show map alongside report' : 'Expand report to full width'}
                  >
                    {expanded ? 'Split view' : 'Expand'}
                  </button>
                ) : null}
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded border border-panel-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted transition hover:border-command-live/40 hover:text-white"
                    aria-label="Close report"
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
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
