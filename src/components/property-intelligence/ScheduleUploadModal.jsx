import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PrimaryButton } from '../ui/CommandControls'
import {
  parseScheduleFile,
  parseSchedulePaste,
  SCHEDULE_MAX_LOCATIONS,
  isAcceptedScheduleFile,
  scheduleFileTypeError,
} from '../../utils/scheduleParse'
import { downloadScheduleTemplate } from '../../utils/scheduleTemplate'

export default function ScheduleUploadModal({ open, onClose, rows, onRowsChange }) {
  const [pasteText, setPasteText] = useState('')
  const [parseError, setParseError] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef(null)
  const dragDepthRef = useRef(0)

  const applyRows = useCallback(
    parsed => {
      onRowsChange(parsed)
      setUploadSuccess(true)
      setParseError('')
    },
    [onRowsChange],
  )

  const processFile = useCallback(
    async file => {
      if (!file) return
      if (!isAcceptedScheduleFile(file)) {
        setParseError(scheduleFileTypeError(file.name))
        return
      }
      setFileLoading(true)
      setParseError('')
      setUploadSuccess(false)
      try {
        const parsed = await parseScheduleFile(file)
        if (!parsed.length) {
          setParseError('No addresses found in file.')
          return
        }
        applyRows(parsed)
      } catch (err) {
        setParseError(err?.message ?? 'Could not parse file.')
      } finally {
        setFileLoading(false)
      }
    },
    [applyRows],
  )

  const handlePasteApply = useCallback(() => {
    setParseError('')
    setUploadSuccess(false)
    const parsed = parseSchedulePaste(pasteText)
    if (!parsed.length) {
      setParseError('Enter at least one address.')
      return
    }
    applyRows(parsed)
  }, [pasteText, applyRows])

  const handleFileInput = useCallback(
    async event => {
      const file = event.target.files?.[0]
      await processFile(file)
      event.target.value = ''
    },
    [processFile],
  )

  const handleDragEnter = useCallback(event => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(event => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback(event => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async event => {
      event.preventDefault()
      event.stopPropagation()
      dragDepthRef.current = 0
      setIsDragging(false)
      const file = event.dataTransfer?.files?.[0]
      await processFile(file)
    },
    [processFile],
  )

  const handleDone = useCallback(() => {
    setUploadSuccess(false)
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDone}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-upload-title"
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-panel-border bg-panel-bg shadow-2xl sm:rounded-xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-panel-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
                    Schedule upload
                  </p>
                  <h2 id="schedule-upload-title" className="font-display mt-1 text-lg font-semibold text-white">
                    Upload location schedule
                  </h2>
                  <p className="mt-1 max-w-lg font-mono text-[10px] leading-relaxed text-ink-faint">
                    Up to {SCHEDULE_MAX_LOCATIONS} US addresses. The map will plot every valid location once you
                    choose a package.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadScheduleTemplate()}
                  className="shrink-0 rounded border border-panel-border bg-panel-surface/60 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-wider text-ink-secondary hover:border-command-live/40 hover:text-white"
                >
                  Template
                </button>
              </div>
            </div>

            <div className="sleek-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Drop Excel or CSV schedule file, or press Enter to browse"
                onClick={() => !fileLoading && fileInputRef.current?.click()}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    if (!fileLoading) fileInputRef.current?.click()
                  }
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition ${
                  isDragging
                    ? 'border-command-live/60 bg-command-live/10'
                    : 'border-panel-border bg-panel-surface/20 hover:border-command-live/40 hover:bg-panel-surface/35'
                } ${fileLoading ? 'pointer-events-none opacity-70' : ''}`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                  {fileLoading ? 'Reading file…' : isDragging ? 'Drop file to upload' : 'Drag & drop schedule file'}
                </p>
                <p className="mt-2 font-mono text-[10px] text-ink-secondary">.xlsx, .xls, or .csv</p>
                <p className="mt-4 rounded border border-panel-border bg-panel-surface/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary">
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={handleFileInput}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 h-px bg-panel-border" aria-hidden />
                <p className="relative mx-auto w-fit bg-panel-bg px-2 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-faint">
                  or paste
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                  Paste addresses
                </label>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="123 Main St, Portland, OR 97201&#10;456 Oak St, Portland, OR 97205"
                  className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePasteApply}
                  className="mt-2 rounded border border-panel-border bg-panel-surface/60 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-secondary hover:border-command-live/40 hover:text-white"
                >
                  Apply pasted addresses
                </button>
              </div>

              {parseError ? (
                <p className="rounded border border-command-critical/30 bg-command-critical/10 px-3 py-2 font-mono text-[10px] text-command-critical">
                  {parseError}
                </p>
              ) : null}

              {uploadSuccess && rows?.length ? (
                <div className="rounded border border-command-stable/30 bg-command-stable/10 px-3 py-2">
                  <p className="font-mono text-[10px] text-command-stable">
                    {rows.length} location{rows.length === 1 ? '' : 's'} loaded. Choose a package in the sidebar to
                    validate and plot on the map.
                  </p>
                </div>
              ) : null}

              {rows?.length ? (
                <div>
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                    Preview · {rows.length} location{rows.length === 1 ? '' : 's'}
                  </p>
                  <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded border border-panel-border bg-black/30 p-2">
                    {rows.map(row => (
                      <li
                        key={`${row.rowIndex}-${row.address}`}
                        className="flex items-start gap-2 rounded px-2 py-1 font-mono text-[10px] text-ink-secondary"
                      >
                        <span className="shrink-0 text-ink-faint">{row.rowIndex}</span>
                        <span className="min-w-0 truncate">
                          {row.locationId ? (
                            <span className="text-ink-faint">{row.locationId} · </span>
                          ) : null}
                          {row.address}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-border px-5 py-4">
              <p className="font-mono text-[9px] text-ink-faint">
                {rows?.length
                  ? `${rows.length} location${rows.length === 1 ? '' : 's'} ready`
                  : 'No locations loaded yet'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDone}
                  className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-white"
                >
                  Cancel
                </button>
                <PrimaryButton type="button" disabled={!rows?.length} onClick={handleDone}>
                  {rows?.length ? 'Continue' : 'Done'}
                </PrimaryButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
