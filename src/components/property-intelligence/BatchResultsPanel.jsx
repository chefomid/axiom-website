import { useEffect, useMemo, useState } from 'react'
import { formatUsd } from '../../services/propertyApi'
import { downloadBatchCopeExcel } from '../../utils/copeReportExcel'
import ConfirmationNumberCopy from './ConfirmationNumberCopy'
import ReportResultsPanel from './ReportResultsPanel'

export default function BatchResultsPanel({
  batchRun,
  loading,
  error,
  apiOnline,
  expanded = false,
  onToggleExpand,
  onPreviewLocation,
  onRequestNewReport = null,
  dossierFocus = false,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportError, setExportError] = useState(null)

  const enriched = useMemo(
    () => (batchRun?.locations ?? []).filter(loc => loc.record),
    [batchRun],
  )

  const activeRecord = enriched[activeIndex]?.record ?? null

  useEffect(() => {
    const loc = enriched[activeIndex]
    if (!loc || !onPreviewLocation) return
    onPreviewLocation(loc)
  }, [activeIndex, enriched, onPreviewLocation])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="text-center">
          <span className="street-view-spinner mx-auto mb-3 block h-4 w-4" aria-hidden />
          <p className="font-mono text-[10px] text-ink-secondary">Running schedule analysis…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col justify-center px-6 py-8">
        <p className="font-mono text-[10px] text-command-critical">{error}</p>
      </div>
    )
  }

  if (!batchRun) return null

  const handleExportExcel = async () => {
    setExportError(null)
    setExportingExcel(true)
    try {
      await downloadBatchCopeExcel(batchRun)
    } catch (err) {
      setExportError(err?.message ?? 'Export failed')
    } finally {
      setExportingExcel(false)
    }
  }

  return (
    <div className="report-dossier flex min-h-0 flex-1 flex-col">
      <div className="report-dossier-header shrink-0 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="report-dossier-label font-mono text-[9px] uppercase tracking-[0.2em]">
              Batch {batchRun.batch_id}
            </p>
            <p className="dossier-value mt-1 font-display text-sm">{batchRun.message}</p>
            <p className="mt-1 font-mono text-[10px] text-ink-faint">
              Charged {formatUsd(batchRun.totals?.user_price_usd)} ·{' '}
              {enriched.length} / {batchRun.totals?.location_count} completed
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {onRequestNewReport ? (
              <button type="button" onClick={onRequestNewReport} className="dossier-btn-primary">
                New report
              </button>
            ) : null}
            {onToggleExpand && !dossierFocus ? (
              <button type="button" onClick={onToggleExpand} className="dossier-btn-ghost">
                {expanded ? 'Split view' : 'Expand'}
              </button>
            ) : null}
          </div>
        </div>
        {batchRun.batch_id ? (
          <ConfirmationNumberCopy
            confirmationId={batchRun.batch_id}
            tone="dossier"
            compact
            className="mt-3"
          />
        ) : null}
        {enriched.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="dossier-btn-secondary"
            >
              {exportingExcel ? 'Exporting…' : 'Export batch Excel'}
            </button>
          </div>
        ) : null}
        {exportError ? (
          <p className="mt-1 font-mono text-[9px] text-command-critical">{exportError}</p>
        ) : null}
        {enriched.length > 1 ? (
          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-wider text-ink-faint">
              Jump to location
            </p>
            <div className="flex flex-wrap gap-1">
              {enriched.map((loc, index) => (
                <button
                  key={loc.report_id ?? loc.row_index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`dossier-tab max-w-[14rem] truncate !normal-case tracking-normal ${
                    index === activeIndex ? 'dossier-tab--active' : ''
                  }`}
                >
                  {loc.row_index ? `${loc.row_index}. ` : ''}
                  {loc.display_name ?? loc.address_input}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeRecord ? (
          <ReportResultsPanel
            variant="panel"
            record={activeRecord}
            error={null}
            loading={false}
            apiOnline={apiOnline}
            showHeader={false}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="font-mono text-[10px] text-ink-muted">No successful location reports.</p>
          </div>
        )}
      </div>
    </div>
  )
}
