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

  const fileInputRef = useRef(null)

  const dragDepthRef = useRef(0)



  const processFile = useCallback(

    async file => {

      if (!file) return

      if (!isAcceptedScheduleFile(file)) {

        setParseError(scheduleFileTypeError(file.name))

        return

      }

      setFileLoading(true)

      setParseError('')

      try {

        const parsed = await parseScheduleFile(file)

        if (!parsed.length) {

          setParseError('No addresses found in file.')

          return

        }

        onRowsChange(parsed)

      } catch (err) {

        setParseError(err?.message ?? 'Could not parse file.')

      } finally {

        setFileLoading(false)

      }

    },

    [onRowsChange],

  )



  const handlePasteApply = useCallback(() => {

    setParseError('')

    const parsed = parseSchedulePaste(pasteText)

    if (!parsed.length) {

      setParseError('Enter at least one address.')

      return

    }

    onRowsChange(parsed)

  }, [pasteText, onRowsChange])



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



  return (

    <AnimatePresence>

      {open ? (

        <motion.div

          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"

          initial={{ opacity: 0 }}

          animate={{ opacity: 1 }}

          exit={{ opacity: 0 }}

          onClick={onClose}

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

              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">

                Schedule upload

              </p>

              <h2 id="schedule-upload-title" className="font-display mt-1 text-lg font-semibold text-white">

                Upload location schedule

              </h2>

              <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-faint">

                Up to {SCHEDULE_MAX_LOCATIONS} US addresses. Download the template, drag in a file, or paste

                comma-separated addresses. Choose a package in the sidebar to validate and price the schedule.

              </p>

            </div>



            <div className="sleek-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">

              <button

                type="button"

                onClick={() => downloadScheduleTemplate()}

                className="rounded border border-panel-border bg-panel-surface/60 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-secondary hover:border-command-live/40 hover:text-white"

              >

                Download Excel template

              </button>



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

                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition ${

                  isDragging

                    ? 'border-command-live/60 bg-command-live/10'

                    : 'border-panel-border bg-panel-surface/20 hover:border-command-live/40 hover:bg-panel-surface/35'

                } ${fileLoading ? 'pointer-events-none opacity-70' : ''}`}

              >

                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">

                  {fileLoading ? 'Reading file…' : isDragging ? 'Drop file to upload' : 'Drag & drop schedule file'}

                </p>

                <p className="mt-2 font-mono text-[10px] text-ink-secondary">

                  .xlsx, .xls, or .csv, not .xlsm

                </p>

                <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-command-live">

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



              <div>

                <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">

                  Paste addresses

                </label>

                <textarea

                  value={pasteText}

                  onChange={e => setPasteText(e.target.value)}

                  rows={4}

                  placeholder="123 Main St, Portland, OR 97201&#10;825 NE Multnomah St, Portland, OR 97232"

                  className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none"

                />

                <button

                  type="button"

                  onClick={handlePasteApply}

                  className="mt-2 font-mono text-[10px] uppercase tracking-wider text-command-live hover:underline"

                >

                  Apply pasted addresses

                </button>

              </div>



              {parseError ? (

                <p className="font-mono text-[10px] text-command-critical">{parseError}</p>

              ) : null}



              {rows?.length ? (

                <div>

                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">

                    {rows.length} location{rows.length === 1 ? '' : 's'} queued

                  </p>

                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-panel-border bg-black/30 p-2">

                    {rows.map(row => (

                      <li key={`${row.rowIndex}-${row.address}`} className="font-mono text-[10px] text-ink-secondary">

                        {row.locationId ? (

                          <span className="text-ink-faint">{row.locationId} · </span>

                        ) : null}

                        {row.address}

                      </li>

                    ))}

                  </ul>

                </div>

              ) : null}

            </div>



            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-panel-border px-5 py-4">

              <button

                type="button"

                onClick={onClose}

                className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-muted hover:text-white"

              >

                Cancel

              </button>

              <PrimaryButton type="button" disabled={!rows?.length} onClick={onClose}>

                Done

              </PrimaryButton>

            </div>

          </motion.div>

        </motion.div>

      ) : null}

    </AnimatePresence>

  )

}


