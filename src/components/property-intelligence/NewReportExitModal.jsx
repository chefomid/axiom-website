import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { buildCopeReportDocument, validateCopeReportDocument } from '../../utils/copeReportDocument'
import { downloadCopeExcel, downloadBatchCopeExcel } from '../../utils/copeReportExcel'

export default function NewReportExitModal({
  open,
  onClose,
  onConfirmNewReport,
  analysisId = null,
  record = null,
  batchRun = null,
}) {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const id = analysisId?.trim() || record?.report_id?.trim() || batchRun?.batch_id?.trim() || ''
  const canExportExcel = Boolean(record?.cope?.sections?.length || batchRun?.locations?.length)

  const handleCopy = useCallback(async () => {
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }, [id])

  const handleDownloadExcel = useCallback(async () => {
    if (exporting) return
    setExportError(null)
    setExporting(true)
    try {
      if (batchRun?.locations?.length) {
        await downloadBatchCopeExcel(batchRun)
      } else if (record) {
        const doc = buildCopeReportDocument(record)
        const errors = validateCopeReportDocument(doc)
        if (errors.length) throw new Error(errors.join(' '))
        await downloadCopeExcel(doc, record.display_name || record.address_input, {
          prefix: 'axiom-analysis',
        })
      } else {
        throw new Error('No report available to download.')
      }
    } catch (err) {
      setExportError(err?.message ?? 'Excel download failed.')
    } finally {
      setExporting(false)
    }
  }, [batchRun, exporting, record])

  const handleOk = useCallback(() => {
    onConfirmNewReport?.()
  }, [onConfirmNewReport])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-report-exit-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-xl overflow-hidden rounded-t-xl border border-[#2a2a2a] bg-[#0d0d0d] shadow-2xl md:rounded-xl"
            onClick={event => event.stopPropagation()}
            layout={false}
          >
            <div className="border-b border-[#222] bg-[#111] px-5 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-command-watch">
                Before you continue
              </p>
              <h2
                id="new-report-exit-title"
                className="font-display mt-1 text-lg font-semibold text-white"
              >
                Save your Analysis ID#
              </h2>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="font-sans text-sm leading-relaxed text-ink-secondary">
                Starting a new report clears this workspace. Keep a copy of your Analysis ID# so you
                can retrieve this dossier later, or download the Excel file now.
              </p>

              {id ? (
                <div className="flex w-full items-center gap-3 rounded-md border border-command-watch/35 bg-command-watch/10 px-3 py-3">
                  <p className="min-w-0 flex-1 font-mono text-[12px] leading-snug text-command-watch">
                    <span className="uppercase tracking-[0.12em]">Analysis ID#:</span>{' '}
                    <span className="text-sm font-semibold tabular-nums tracking-wide">{id}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="shrink-0 rounded border border-command-watch/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-command-watch transition hover:bg-command-watch/15"
                  >
                    <span className="inline-block min-w-[3.25rem] text-center">
                      {copied ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
              ) : (
                <p className="font-mono text-[10px] text-command-watch">
                  No Analysis ID# is available for this session.
                </p>
              )}

              <div className="min-h-[1.1rem]">
                {exportError ? (
                  <p className="font-mono text-[10px] text-command-critical">{exportError}</p>
                ) : null}
              </div>

              <div className="flex flex-nowrap items-stretch gap-2 pt-1">
                {canExportExcel ? (
                  <button
                    type="button"
                    onClick={() => void handleDownloadExcel()}
                    disabled={exporting}
                    aria-busy={exporting}
                    className="inline-flex min-w-0 flex-1 items-center justify-center rounded border border-[#e8a838] bg-[#e8a838] px-2 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#141414] transition hover:bg-[#f0b54a] disabled:cursor-wait disabled:opacity-80 sm:text-[10px] sm:tracking-[0.12em]"
                  >
                    {exporting ? 'Downloading…' : 'Download Excel report'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-0 flex-1 rounded border border-[#333] px-2 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-secondary transition hover:border-[#555] hover:text-white sm:text-[10px] sm:tracking-[0.12em]"
                >
                  Stay on report
                </button>
                <button
                  type="button"
                  onClick={handleOk}
                  className="min-w-0 flex-1 rounded border border-white/20 bg-white px-2 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-[#e8e8e8] sm:text-[10px] sm:tracking-[0.12em]"
                >
                  OK, new report
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
