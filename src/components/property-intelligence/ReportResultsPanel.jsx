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
import ConfirmationNumberCopy from './ConfirmationNumberCopy'

const BASE_TABS = [
  { id: 'cope', label: 'COPE' },
  { id: 'sources', label: 'Sources' },
  { id: 'hazards', label: 'Hazards' },
]
const IMAGE_TAB = { id: 'image', label: 'Image' }
const SOV_TAB = { id: 'sov', label: 'SOV' }

function CollapseChevron({ expanded, onToggle, label = 'report details' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      className="dossier-btn-ghost shrink-0"
      title={expanded ? 'Collapse details' : 'Expand details'}
    >
      <span
        className={`block font-mono text-[11px] leading-none transition-transform duration-150 ${
          expanded ? 'rotate-180' : ''
        }`}
        aria-hidden
      >
        ▾
      </span>
    </button>
  )
}

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
  showHeader = true,
  onRequestNewReport = null,
  dossierFocus = false,
}) {
  const isPanel = variant === 'panel'
  const [open, setOpen] = useState(Boolean(record))
  const [activeTab, setActiveTab] = useState('cope')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [summaryExpanded, setSummaryExpanded] = useState(true)

  useEffect(() => {
    if (record) setOpen(true)
  }, [record])

  useEffect(() => {
    setSummaryExpanded(true)
  }, [record?.report_id])

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

  const reportSummary = (
    <>
      {hazardLink ? (
        <div className="border-b border-panel-border/60 px-5 py-3">
          {publicDataCommandEnabled ? (
            <Link
              to={hazardLink}
              target="_blank"
              rel="noopener noreferrer"
              className="dossier-link inline-flex items-center gap-1 font-sans text-xs"
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
              className="dossier-link inline-flex items-center gap-1 font-sans text-xs"
            >
              View hazards for this location
            </button>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-panel-border/60 px-5 py-3">
        {record.cope?.sections?.length ? (
          <>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || exportingExcel}
              className="dossier-btn-primary"
            >
              {exportingPdf ? 'Exporting…' : 'Export COPE PDF'}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingPdf || exportingExcel}
              className="dossier-btn-secondary"
            >
              {exportingExcel ? 'Exporting…' : 'Export COPE Excel'}
            </button>
          </>
        ) : null}
        {exportError ? (
          <span className="font-sans text-xs text-command-critical">{exportError}</span>
        ) : null}
      </div>
    </>
  )

  const reportBody = (
    <>
      {summaryExpanded ? reportSummary : null}

      <div className="flex items-center gap-2 border-b border-panel-border/60 px-5 py-2">
        {!summaryExpanded && record.report_id ? (
          <span className="dossier-value min-w-0 truncate font-mono text-[10px] tabular-nums">
            Analysis ID# {record.report_id}
          </span>
        ) : null}
        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sleek-scrollbar"
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
              className={`dossier-tab shrink-0 ${activeTab === tab.id ? 'dossier-tab--active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!showHeader ? (
          <CollapseChevron
            expanded={summaryExpanded}
            onToggle={() => setSummaryExpanded(expanded => !expanded)}
          />
        ) : null}
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

  const statusDot =
    record.status === 'complete'
      ? 'bg-command-stable'
      : record.status === 'partial'
        ? 'bg-command-watch'
        : 'bg-[color:var(--dossier-ink-faint,#787878)]'

  if (isPanel) {
    return (
      <div className="report-dossier flex h-full min-h-0 flex-col">
        {showHeader ? (
          <div className="report-dossier-header shrink-0 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="report-dossier-label font-mono text-[10px] uppercase tracking-[0.16em]">
                  Report results
                </p>
                <p className="dossier-value mt-1 flex items-center gap-2 font-display text-lg font-semibold capitalize">
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden />
                  {record.status}
                </p>
                {summaryExpanded && record.display_name ? (
                  <p className="report-dossier-address mt-1.5 font-sans text-sm leading-relaxed">
                    {record.display_name}
                  </p>
                ) : null}
                {!summaryExpanded && record.display_name ? (
                  <p className="report-dossier-address--muted mt-1 line-clamp-1 font-sans text-xs">
                    {record.display_name}
                  </p>
                ) : null}
                {record.report_id ? (
                  <div className="mt-2">
                    <ConfirmationNumberCopy
                      confirmationId={record.report_id}
                      tone="dossier"
                      compact
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {onRequestNewReport ? (
                  <button
                    type="button"
                    onClick={onRequestNewReport}
                    className="dossier-btn-primary"
                  >
                    New report
                  </button>
                ) : null}
                <div className="flex items-center gap-1.5">
                  <CollapseChevron
                    expanded={summaryExpanded}
                    onToggle={() => setSummaryExpanded(expanded => !expanded)}
                    label="report summary"
                  />
                  {onToggleExpand && !dossierFocus ? (
                    <button
                      type="button"
                      onClick={onToggleExpand}
                      className="dossier-btn-ghost"
                      title={expanded ? 'Show map alongside report' : 'Expand report to full width'}
                    >
                      {expanded ? 'Split view' : 'Expand'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">{reportBody}</div>
      </div>
    )
  }

  return (
    <div className="report-dossier border-b border-panel-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-panel-surface/30"
      >
        <span>
          <span className="report-dossier-label font-mono text-[10px] uppercase tracking-[0.16em]">
            Report results
          </span>
          <span className="dossier-value mt-1 flex items-center gap-2 font-display text-sm font-semibold capitalize">
            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden />
            {record.status}
          </span>
        </span>
        <span className="font-mono text-sm text-ink-faint">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-panel-border/60">{reportBody}</div> : null}
    </div>
  )
}
