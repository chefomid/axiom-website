import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { fetchReportByConfirmation } from '../../services/propertyApi'
import { formatBillingError } from '../../utils/apiErrors'
import { PrimaryButton } from '../ui/CommandControls'

import BatchResultsPanel from './BatchResultsPanel'
import ReportResultsPanel from './ReportResultsPanel'

const POLL_MS = 3000
const MAX_POLLS = 40

function normalizeConfirmationInput(raw) {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) return ''
  if (/^[AB]X-[0-9A-F]{8}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/^AX-?/i, '').replace(/[^0-9A-F]/gi, '').slice(0, 8)
  if (digits.length === 8) return `AX-${digits}`
  return trimmed
}

export default function ReportConfirmationModal({ open, onClose, onReportReady, apiOnline }) {
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState(null)
  const [record, setRecord] = useState(null)
  const [batchRun, setBatchRun] = useState(null)
  const pollRef = useRef(null)
  const pollCountRef = useRef(0)

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current)
      pollRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  const reset = useCallback(() => {
    clearPolling()
    setPhase('idle')
    setError(null)
    setRecord(null)
    setBatchRun(null)
    setInput('')
  }, [clearPolling])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => () => clearPolling(), [clearPolling])

  const applyRecord = useCallback(
    data => {
      if (data.batch_id && Array.isArray(data.locations)) {
        setBatchRun(data)
        setRecord(null)
        onReportReady?.({ type: 'batch', batchRun: data })
        return
      }
      if (data.report_id) {
        setRecord(data)
        setBatchRun(null)
        onReportReady?.({ type: 'single', record: data })
      }
    },
    [onReportReady],
  )

  const pollConfirmation = useCallback(
    async confirmationId => {
      try {
        const result = await fetchReportByConfirmation(confirmationId)
        if (result.status === 'pending') {
          setPhase('pending')
          pollCountRef.current += 1
          if (pollCountRef.current >= MAX_POLLS) {
            setPhase('pending-timeout')
            clearPolling()
            return
          }
          pollRef.current = window.setTimeout(() => {
            void pollConfirmation(confirmationId)
          }, POLL_MS)
          return
        }
        if (result.status === 'failed') {
          setPhase('error')
          setError(result.message ?? 'This report could not be completed.')
          clearPolling()
          return
        }
        if (result.status === 'ready' && result.record) {
          setPhase('ready')
          applyRecord(result.record)
          clearPolling()
        }
      } catch (err) {
        setPhase('error')
        setError(formatBillingError(err, 'We could not load that report. Check the number and try again.'))
        clearPolling()
      }
    },
    [applyRecord, clearPolling],
  )

  const handleSubmit = useCallback(
    event => {
      event.preventDefault()
      const confirmationId = normalizeConfirmationInput(input)
      if (!confirmationId) {
        setError('Enter your Analysis ID# (for example AX-1A2B3C4D).')
        return
      }
      setError(null)
      setPhase('loading')
      setRecord(null)
      setBatchRun(null)
      pollCountRef.current = 0
      clearPolling()
      void pollConfirmation(confirmationId)
    },
    [input, pollConfirmation, clearPolling],
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-confirmation-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[240] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl md:rounded md:border"
            onClick={event => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-panel-border px-5 py-4 md:px-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Report retrieval</p>
              <h2 id="report-confirmation-title" className="font-display mt-1 text-lg font-semibold text-white">
                Retrieve with Analysis ID#
              </h2>
            </div>

            <div className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
              {phase === 'ready' && (record || batchRun) ? (
                <div className="-mx-1">
                  {record ? (
                    <ReportResultsPanel
                      record={record}
                      loading={false}
                      error={null}
                      apiOnline={apiOnline}
                      variant="panel"
                      showHeader={false}
                    />
                  ) : null}
                  {batchRun ? (
                    <BatchResultsPanel batchRun={batchRun} loading={false} error={null} apiOnline={apiOnline} />
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                      Analysis ID#
                    </span>
                    <input
                      type="text"
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      placeholder="AX-1A2B3C4D"
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-2 w-full rounded border border-panel-border bg-black/40 px-3 py-2.5 font-mono text-sm text-white placeholder:text-ink-faint focus:border-[#444] focus:outline-none"
                    />
                  </label>

                  {phase === 'loading' || phase === 'pending' ? (
                    <div className="flex items-center gap-2 py-2">
                      <span className="street-view-spinner h-4 w-4 shrink-0" aria-hidden />
                      <p className="font-sans text-sm text-ink-secondary">Report is still being prepared…</p>
                    </div>
                  ) : null}

                  {phase === 'pending-timeout' ? (
                    <p className="font-sans text-sm leading-relaxed text-ink-secondary">
                      Your report is still processing. Try again in a few minutes with the same Analysis ID#.
                    </p>
                  ) : null}

                  {error ? (
                    <p className="font-sans text-sm leading-relaxed text-ink-secondary">{error}</p>
                  ) : null}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary hover:text-white"
                    >
                      Cancel
                    </button>
                    <PrimaryButton type="submit" disabled={phase === 'loading' || phase === 'pending'}>
                      {phase === 'loading' || phase === 'pending' ? 'Checking…' : 'Retrieve report'}
                    </PrimaryButton>
                  </div>
                </form>
              )}
            </div>

            {phase === 'ready' ? (
              <div className="shrink-0 border-t border-panel-border px-5 py-4 md:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded border border-panel-border py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary hover:text-white"
                >
                  Close
                </button>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
