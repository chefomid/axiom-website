import { useEffect, useMemo, useState } from 'react'
import { formatUsd } from '../../services/propertyApi'
import { downloadBatchCopeExcel } from '../../utils/copeReportExcel'
import { isConfirmationEmailSent } from '../../utils/confirmationEmailSent'
import EmailConfirmationButton from './EmailConfirmationButton'
import EmailConfirmationCloseModal from './EmailConfirmationCloseModal'
import { defaultReportNameFromBatch } from '../../utils/reportName'
import ReportResultsPanel from './ReportResultsPanel'

export default function BatchResultsPanel({
  batchRun,
  loading,
  error,
  apiOnline,
  expanded = false,
  onToggleExpand,
  onClose,
  onPreviewLocation,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [emailClosePromptOpen, setEmailClosePromptOpen] = useState(false)
  const [emailSent, setEmailSent] = useState(() => isConfirmationEmailSent(batchRun?.batch_id))

  useEffect(() => {
    setEmailSent(isConfirmationEmailSent(batchRun?.batch_id))
    setEmailFormOpen(false)
    setEmailClosePromptOpen(false)
  }, [batchRun?.batch_id])

  const handlePanelClose = () => {
    if (batchRun?.batch_id && !emailSent && !isConfirmationEmailSent(batchRun.batch_id)) {
      setEmailClosePromptOpen(true)
      return
    }
    onClose?.()
  }

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-panel-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
              Batch {batchRun.batch_id}
            </p>
            <p className="mt-1 font-display text-sm text-white">{batchRun.message}</p>
            <p className="mt-1 font-mono text-[10px] text-ink-faint">
              Charged {formatUsd(batchRun.totals?.user_price_usd)} ·{' '}
              {enriched.length} / {batchRun.totals?.location_count} completed
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                className="rounded border border-panel-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted transition hover:border-command-live/40 hover:text-white"
              >
                {expanded ? 'Split view' : 'Expand'}
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={handlePanelClose}
                className="rounded border border-panel-border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-muted transition hover:border-command-live/40 hover:text-white"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
        {enriched.length > 0 || batchRun.batch_id ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {enriched.length > 0 ? (
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="rounded border border-panel-border px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary hover:border-command-live/40 hover:text-white disabled:opacity-50"
              >
                {exportingExcel ? 'Exporting…' : 'Export batch Excel'}
              </button>
            ) : null}
            {batchRun.batch_id ? (
              <EmailConfirmationButton
                confirmationId={batchRun.batch_id}
                defaultReportName={defaultReportNameFromBatch(batchRun)}
                open={emailFormOpen}
                onOpenChange={setEmailFormOpen}
                onSent={() => setEmailSent(true)}
              />
            ) : null}
          </div>
        ) : null}
        {exportError ? (
          <p className="mt-1 font-mono text-[9px] text-command-critical">{exportError}</p>
        ) : null}
        <EmailConfirmationCloseModal
          open={emailClosePromptOpen}
          confirmationId={batchRun.batch_id}
          onSendEmail={() => {
            setEmailClosePromptOpen(false)
            setEmailFormOpen(true)
          }}
          onCloseAnyway={() => {
            setEmailClosePromptOpen(false)
            onClose?.()
          }}
        />
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
                  className={`max-w-[14rem] truncate rounded border px-2 py-1 font-mono text-[9px] transition ${
                    index === activeIndex
                      ? 'border-command-live/50 bg-command-live/10 text-white'
                      : 'border-panel-border text-ink-muted hover:border-command-live/30 hover:text-white'
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
            hideEmailButton
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
