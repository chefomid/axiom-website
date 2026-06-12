import { useEffect, useRef, useState } from 'react'
import { organizeThoughts } from '../../services/careersApi'

const INPUT_CLASS =
  'w-full rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-faint transition-colors focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25'

const DATE_INPUT_CLASS =
  'w-[10.75rem] shrink-0 cursor-pointer rounded-lg border border-panel-border bg-panel-surface/60 px-3 py-2.5 text-sm text-ink-primary [color-scheme:dark] transition-colors focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:hover:opacity-100'

const INPUT_ERROR_CLASS = 'border-command-critical/60 focus:border-command-critical/60 focus:ring-command-critical/25'

function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function FieldShell({ field, error, children }) {
  return (
    <div>
      <label htmlFor={field.id} className="block text-sm font-medium leading-relaxed text-ink-primary">
        {field.label}
      </label>
      {field.hint ? <p className="mt-1 text-xs text-ink-muted">{field.hint}</p> : null}
      <div className="mt-2.5">{children}</div>
      {error ? (
        <p className="mt-2 font-mono text-[11px] text-command-critical" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ field, value, error, onChange }) {
  return (
    <FieldShell field={field} error={error}>
      <input
        id={field.id}
        type={field.type === 'text' ? 'text' : field.type}
        value={value ?? ''}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        onChange={e => onChange(e.target.value)}
        className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`.trim()}
      />
    </FieldShell>
  )
}

export function DateInput({ field, value, error, onChange }) {
  const inputRef = useRef(null)

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    input.focus()
    try {
      if (typeof input.showPicker === 'function') input.showPicker()
    } catch {
      /* showPicker requires a user gesture in some browsers */
    }
  }

  return (
    <FieldShell field={field} error={error}>
      <div className="inline-flex w-fit max-w-full items-center gap-2">
        <input
          ref={inputRef}
          id={field.id}
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          onClick={openPicker}
          className={`${DATE_INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`.trim()}
        />
        <button
          type="button"
          onClick={() => onChange(todayIsoDate())}
          className="shrink-0 rounded-lg border border-panel-border bg-panel-surface/40 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:border-[#3a3a3a] hover:text-white"
        >
          Today
        </button>
      </div>
    </FieldShell>
  )
}

const SELECT_TRIGGER_CLASS =
  'flex w-full items-center justify-between gap-3 rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-left text-sm transition-colors focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25'

function ChevronDownIcon({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Collapsible dropdown. Single pick closes on select; multi pick uses checkmarks. */
export function SelectInput({ field, value, error, onChange, onOtherChange, otherValue }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const isMultiple = Boolean(field.multiple)
  const options = field.options ?? []
  const selected = isMultiple ? (Array.isArray(value) ? value : []) : []
  const singleValue = isMultiple ? '' : (value ?? '')

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function toggleOption(option) {
    if (isMultiple) {
      const current = Array.isArray(value) ? value : []
      onChange(
        current.includes(option)
          ? current.filter(item => item !== option)
          : [...current, option],
      )
      return
    }
    onChange(option)
    setOpen(false)
  }

  function triggerLabel() {
    if (isMultiple) {
      if (selected.length === 0) return field.placeholder ?? 'Select options'
      if (selected.length === 1) return selected[0]
      return `${selected.length} selected`
    }
    return singleValue || field.placeholder || 'Select an option'
  }

  const showPlaceholder = isMultiple ? selected.length === 0 : !singleValue

  return (
    <FieldShell field={field} error={error}>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={field.id}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
          className={`${SELECT_TRIGGER_CLASS} ${error ? INPUT_ERROR_CLASS : ''} ${
            showPlaceholder ? 'text-ink-faint' : 'text-ink-primary'
          }`.trim()}
        >
          <span className="min-w-0 truncate">{triggerLabel()}</span>
          <ChevronDownIcon open={open} />
        </button>

        {open ? (
          <ul
            role="listbox"
            aria-multiselectable={isMultiple || undefined}
            className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-lg border border-panel-border bg-[#111] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            {options.map(option => {
              const active = isMultiple ? selected.includes(option) : singleValue === option
              return (
                <li key={option} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggleOption(option)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? 'bg-command-live/10 text-white'
                        : 'text-ink-secondary hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {isMultiple ? (
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          active
                            ? 'border-command-live/60 bg-command-live/20 text-command-live'
                            : 'border-[#3a3a3a] bg-panel-surface/60'
                        }`}
                      >
                        {active ? (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                            <path
                              d="M2 6.5 4.8 9 10 3.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">{option}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {field.allowOther && !isMultiple && singleValue === 'Other' ? (
        <input
          type="text"
          value={otherValue ?? ''}
          placeholder="Describe your status\u2026"
          aria-label={`${field.label}, other`}
          onChange={event => onOtherChange(event.target.value)}
          className={`${INPUT_CLASS} mt-3`}
        />
      ) : null}
    </FieldShell>
  )
}

export function TextAreaInput({ field, value, error, onChange }) {
  const dictation = useSpeechDictation(value, onChange)
  const [polishing, setPolishing] = useState(false)

  return (
    <FieldShell field={field} error={error}>
      <textarea
        id={field.id}
        value={value ?? ''}
        rows={field.rows ?? 6}
        placeholder={field.placeholder ?? '\u2026'}
        onChange={e => dictation.handleManualChange(e.target.value)}
        className={`careers-textarea ${INPUT_CLASS} resize-y leading-relaxed ${error ? INPUT_ERROR_CLASS : ''} ${
          dictation.listening ? 'border-command-stable/40 ring-1 ring-command-stable/15' : ''
        } ${polishing ? 'careers-textarea--polishing' : ''}`.trim()}
      />
      <SpeechDictationControl
        dictation={dictation}
        value={value}
        question={field.label}
        onOrganized={onChange}
        onPolishingChange={setPolishing}
      />
    </FieldShell>
  )
}

function appendTranscript(current, transcript) {
  const base = current ?? ''
  const chunk = transcript.trim()
  if (!chunk) return base
  const separator = base && !/\s$/.test(base) ? ' ' : ''
  return `${base}${separator}${chunk}`
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function useSpeechDictation(value, onChange) {
  const onChangeRef = useRef(onChange)
  const recognitionRef = useRef(null)
  const sessionBaseRef = useRef('')
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()))
  const [speechError, setSpeechError] = useState(null)
  const [readyToOrganize, setReadyToOrganize] = useState(false)
  const [pendingRestart, setPendingRestart] = useState(false)

  onChangeRef.current = onChange

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  function stop() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
    setReadyToOrganize(true)
  }

  function composeSessionText(base, finalized, interim) {
    let text = base ?? ''
    if (finalized) text = appendTranscript(text, finalized)
    if (interim) {
      const chunk = interim.trimEnd()
      if (!chunk) return text
      const separator = text && !/\s$/.test(text) ? ' ' : ''
      text = `${text}${separator}${chunk}`
    }
    return text
  }

  function beginSession({ clearContent }) {
    const SpeechRecognition = getSpeechRecognitionCtor()
    if (!SpeechRecognition) return

    setSpeechError(null)
    if (clearContent) {
      onChangeRef.current('')
      setReadyToOrganize(false)
      sessionBaseRef.current = ''
    } else {
      sessionBaseRef.current = value ?? ''
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = event => {
      let finalized = ''
      let interim = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript
        if (event.results[index].isFinal) finalized += transcript
        else interim += transcript
      }
      onChangeRef.current(composeSessionText(sessionBaseRef.current, finalized, interim))
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = event => {
      if (event.error === 'not-allowed') {
        setSpeechError('Microphone access was blocked. Allow mic access or type your answer.')
      } else if (event.error !== 'aborted') {
        setSpeechError('Dictation stopped. Tap to try again.')
      }
      stop()
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function toggle() {
    if (listening) {
      stop()
      return
    }

    if (String(value ?? '').trim()) {
      setPendingRestart(true)
      return
    }

    beginSession({ clearContent: false })
  }

  function confirmRestart() {
    setPendingRestart(false)
    beginSession({ clearContent: true })
  }

  function cancelRestart() {
    setPendingRestart(false)
  }

  function handleManualChange(next) {
    if (listening) stop()
    if (!String(next).trim()) setReadyToOrganize(false)
    onChangeRef.current(next)
  }

  function clearReadyToOrganize() {
    setReadyToOrganize(false)
  }

  return {
    listening,
    supported,
    speechError,
    readyToOrganize,
    pendingRestart,
    toggle,
    stop,
    handleManualChange,
    confirmRestart,
    cancelRestart,
    clearReadyToOrganize,
  }
}

function MicIcon({ active, size = 18 }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      width={size}
      height={size}
      className="shrink-0"
      fill="none"
    >
      <rect
        x="5.5"
        y="2.5"
        width="5"
        height="7"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        className={active ? 'animate-pulse' : undefined}
      />
      <path
        d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DictationRestartDialog({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dictation-restart-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <p
          id="dictation-restart-title"
          className="font-display text-lg font-medium tracking-tight text-white"
        >
          Start a new recording?
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          This will clear your current answer and record from scratch.
        </p>
        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
          >
            Clear and record
          </button>
        </div>
      </div>
    </div>
  )
}

function SpeechDictationControl({
  dictation,
  value,
  question,
  onOrganized,
  onPolishingChange,
  className = '',
}) {
  const {
    listening,
    supported,
    speechError,
    readyToOrganize,
    pendingRestart,
    toggle,
    confirmRestart,
    cancelRestart,
    clearReadyToOrganize,
  } = dictation
  const [polishError, setPolishError] = useState(null)
  const polishRunRef = useRef(0)

  useEffect(() => {
    if (!readyToOrganize || listening || !String(value ?? '').trim()) return

    const runId = ++polishRunRef.current
    let cancelled = false

    onPolishingChange?.(true)
    setPolishError(null)

    organizeThoughts(value, { question })
      .then(result => {
        if (cancelled) return
        onOrganized(result.text)
        clearReadyToOrganize()
      })
      .catch(err => {
        if (cancelled) return
        setPolishError(err?.message ?? 'Could not polish your answer. Try again.')
        clearReadyToOrganize()
      })
      .finally(() => {
        if (cancelled) return
        onPolishingChange?.(false)
      })

    return () => {
      cancelled = true
      polishRunRef.current += 1
      onPolishingChange?.(false)
    }
  }, [
    readyToOrganize,
    listening,
    value,
    question,
    onOrganized,
    clearReadyToOrganize,
    onPolishingChange,
  ])

  if (!supported) return null

  return (
    <>
      {pendingRestart ? (
        <DictationRestartDialog onConfirm={confirmRestart} onCancel={cancelRestart} />
      ) : null}
      <div className={`mt-2 ${className}`.trim()}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={listening}
            aria-label={listening ? 'Listening, tap to stop' : 'Dictate instead of typing'}
            className={`field-icon-tooltip-btn transition-colors ${
              listening
                ? 'text-command-watch'
                : 'text-command-stable hover:text-command-cyber'
            }`}
          >
            <MicIcon active={listening} size={18} />
            <span className="field-icon-tooltip" role="tooltip">
              {listening ? 'Listening\u2026 tap to stop' : 'Dictate instead of typing'}
            </span>
          </button>
        </div>
        {listening ? (
          <p className="mt-1.5 text-xs text-ink-muted">Words appear as you speak.</p>
        ) : null}
        {polishError ? (
          <p className="mt-1.5 text-xs text-command-critical" role="alert">
            {polishError}
          </p>
        ) : null}
        {speechError ? (
          <p className="mt-1.5 text-xs text-command-critical" role="alert">
            {speechError}
          </p>
        ) : null}
      </div>
    </>
  )
}

function OptionPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-left text-[13px] transition-all duration-200 ${
        active
          ? 'border-command-live/50 bg-command-live/10 text-white ring-1 ring-command-live/25'
          : 'border-panel-border bg-panel-surface/40 text-ink-secondary hover:border-[#3a3a3a] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** Single-select pill group. value: string */
export function ChoiceInput({ field, value, error, onChange }) {
  return (
    <FieldShell field={field} error={error}>
      <div className="flex flex-wrap gap-2">
        {field.options.map(option => (
          <OptionPill
            key={option}
            active={value === option}
            onClick={() => onChange(value === option ? '' : option)}
          >
            {option}
          </OptionPill>
        ))}
      </div>
    </FieldShell>
  )
}

/** Multi-select pill group. value: string[]; optional free-text "Other" and maxSelections cap. */
export function MultiSelectInput({ field, value, otherValue, error, onChange, onOtherChange }) {
  const selected = Array.isArray(value) ? value : []
  const maxSelections = field.maxSelections ?? Infinity
  const atMax = selected.length >= maxSelections

  function toggle(option) {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option))
      return
    }
    if (atMax) return
    onChange([...selected, option])
  }

  return (
    <FieldShell field={field} error={error}>
      <div className="flex flex-wrap gap-2">
        {field.options.map(option => {
          const active = selected.includes(option)
          const disabled = !active && atMax
          return (
            <OptionPill
              key={option}
              active={active}
              onClick={() => !disabled && toggle(option)}
            >
              <span className={disabled ? 'opacity-40' : undefined}>{option}</span>
            </OptionPill>
          )
        })}
      </div>
      {field.allowOther ? (
        <input
          type="text"
          value={otherValue ?? ''}
          placeholder={'Other\u2026'}
          aria-label={`${field.label}, other`}
          onChange={e => onOtherChange(e.target.value)}
          className={`${INPUT_CLASS} mt-3`}
        />
      ) : null}
    </FieldShell>
  )
}

/** Group of numeric self-rating scales. value: { [itemId]: number } */
export function RatingGroupInput({ field, value, error, onChange }) {
  const ratings = value ?? {}
  const max = field.max ?? 5
  const scores = Array.from({ length: max }, (_, index) => index + 1)
  const compact = max > 5

  return (
    <FieldShell field={field} error={error}>
      {field.scaleHint ? (
        <p className="-mt-1 mb-3 text-xs text-ink-muted">{field.scaleHint}</p>
      ) : null}
      <div className="space-y-4 rounded-xl border border-panel-border bg-panel-surface/30 p-4 sm:p-5">
        {field.itemPrefix ? (
          <p className="text-[13px] font-medium leading-snug text-ink-primary">{field.itemPrefix}</p>
        ) : null}
        {field.items.map(item => (
          <div
            key={item.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <span className="text-[13px] leading-snug text-ink-secondary">{item.label}</span>
            <div className="flex shrink-0 flex-wrap gap-1.5" role="radiogroup" aria-label={item.label}>
              {scores.map(score => {
                const active = ratings[item.id] === score
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...ratings, [item.id]: active ? undefined : score })}
                    className={`rounded-lg border font-mono transition-all duration-200 ${
                      compact ? 'h-8 w-8 text-[11px]' : 'h-9 w-9 text-[12px]'
                    } ${
                      active
                        ? 'border-command-live/50 bg-command-live/15 text-white ring-1 ring-command-live/25'
                        : 'border-panel-border bg-panel-surface/40 text-ink-faint hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    {score}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </FieldShell>
  )
}

const LIKERT_LABELS = [
  { score: 1, short: 'SD', label: 'Strongly Disagree' },
  { score: 2, short: 'D', label: 'Disagree' },
  { score: 3, short: 'N', label: 'Neutral' },
  { score: 4, short: 'A', label: 'Agree' },
  { score: 5, short: 'SA', label: 'Strongly Agree' },
]

function LikertLegend() {
  return (
    <div
      className="mb-3 rounded-lg border border-panel-border/60 bg-panel-surface/20 px-3 py-2.5"
      aria-label="Rating scale legend"
    >
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">Legend</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LIKERT_LABELS.map(({ short, label }) => (
          <span key={short} className="text-[12px] leading-snug text-ink-muted">
            <span className="font-mono font-medium text-ink-secondary">{short}</span>
            {' = '}
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Likert agreement scales. value: { [itemId]: number } */
export function LikertGroupInput({ field, value, error, onChange }) {
  const ratings = value ?? {}

  return (
    <FieldShell field={field} error={error}>
      <LikertLegend />
      <div className="space-y-4 rounded-xl border border-panel-border bg-panel-surface/30 p-4 sm:p-5">
        {field.items.map(item => (
          <div
            key={item.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <span className="text-[13px] leading-snug text-ink-secondary">{item.label}</span>
            <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={item.label}>
              {LIKERT_LABELS.map(({ score, short, label }) => {
                const active = ratings[item.id] === score
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={label}
                    title={label}
                    onClick={() => onChange({ ...ratings, [item.id]: active ? undefined : score })}
                    className={`h-9 w-9 rounded-lg border font-mono text-[11px] transition-all duration-200 sm:w-11 ${
                      active
                        ? 'border-command-live/50 bg-command-live/15 text-white ring-1 ring-command-live/25'
                        : 'border-panel-border bg-panel-surface/40 text-ink-faint hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </FieldShell>
  )
}

/** Per-item Yes / No responses. value: { [itemId]: 'Yes' | 'No' } */
export function YesNoGroupInput({ field, value, error, onChange }) {
  const answers = value ?? {}

  return (
    <FieldShell field={field} error={error}>
      <div className="space-y-3 rounded-xl border border-panel-border bg-panel-surface/30 p-4 sm:p-5">
        {field.items.map(item => (
          <div
            key={item.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <span className="text-[13px] leading-snug text-ink-secondary">{item.label}</span>
            <div className="flex shrink-0 gap-2">
              {['Yes', 'No'].map(option => (
                <OptionPill
                  key={option}
                  active={answers[item.id] === option}
                  onClick={() =>
                    onChange({
                      ...answers,
                      [item.id]: answers[item.id] === option ? undefined : option,
                    })
                  }
                >
                  {option}
                </OptionPill>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FieldShell>
  )
}

/** Fill-in-the-blank commitment sentences. value: { [itemId]: string } */
export function SentenceGroupInput({ field, value, error, onChange }) {
  const answers = value ?? {}

  return (
    <FieldShell field={field} error={error}>
      <div className="space-y-4 rounded-xl border border-panel-border bg-panel-surface/30 p-4 sm:p-5">
        {field.items.map(item => (
          <SentenceDictationField
            key={item.id}
            item={item}
            field={field}
            value={answers[item.id] ?? ''}
            onChange={next => onChange({ ...answers, [item.id]: next })}
          />
        ))}
      </div>
    </FieldShell>
  )
}

function SentenceDictationField({ item, field, value, onChange }) {
  const dictation = useSpeechDictation(value, onChange)

  return (
    <div>
      <label htmlFor={`${field.id}__${item.id}`} className="text-[13px] leading-snug text-ink-secondary">
        {item.prefix}
      </label>
      <input
        id={`${field.id}__${item.id}`}
        type="text"
        value={value}
        placeholder={item.placeholder ?? 'Your answer\u2026'}
        onChange={event => dictation.handleManualChange(event.target.value)}
        className={`${INPUT_CLASS} mt-2 ${dictation.listening ? 'border-command-stable/40 ring-1 ring-command-stable/15' : ''}`.trim()}
      />
      <SpeechDictationControl
        dictation={dictation}
        value={value}
        question={item.prefix}
        onOrganized={onChange}
      />
    </div>
  )
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Resume or document upload. value: { name, type, dataUrl } | null */
export function FileInput({ field, value, error, onChange }) {
  const fileName = value?.name

  function handleChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      onChange(null)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      onChange({ error: 'File must be 5 MB or smaller.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onChange({
        name: file.name,
        type: file.type || 'application/octet-stream',
        dataUrl: reader.result,
      })
    }
    reader.readAsDataURL(file)
  }

  const displayError = error || value?.error

  return (
    <FieldShell field={field} error={displayError}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          htmlFor={field.id}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-panel-border bg-panel-surface/40 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:border-[#3a3a3a] hover:text-white"
        >
          Choose file
        </label>
        <input
          id={field.id}
          type="file"
          accept={field.accept ?? '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg'}
          onChange={handleChange}
          className="sr-only"
        />
        <span className="text-sm text-ink-muted">
          {fileName && !value?.error ? fileName : 'PDF, Word, or image, max 5 MB'}
        </span>
        {fileName && !value?.error ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink-secondary"
          >
            Remove
          </button>
        ) : null}
      </div>
    </FieldShell>
  )
}

/** Required acknowledgement checkboxes. value: { [itemId]: boolean } */
export function CheckboxGroupInput({ field, value, error, onChange }) {
  const checks = value ?? {}

  return (
    <FieldShell field={field} error={error}>
      <div className="space-y-2.5 rounded-xl border border-panel-border bg-panel-surface/30 p-4 sm:p-5">
        {field.items.map(item => {
          const checked = Boolean(checks[item.id])
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onChange({ ...checks, [item.id]: !checked })}
              className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-all duration-200 ${
                  checked
                    ? 'border-command-stable/60 bg-command-stable/15 text-command-stable'
                    : 'border-[#3a3a3a] bg-panel-surface/60 text-transparent group-hover:border-[#555]'
                }`}
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path d="M2 6.5 4.8 9 10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={`text-[13px] leading-snug ${checked ? 'text-ink-primary' : 'text-ink-secondary'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}
