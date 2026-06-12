import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Nav from '../Nav'
import SiteFooter from '../SiteFooter'
import { GhostButton, PrimaryButton } from '../ui/CommandControls'
import {
  APPLICATION_DRAFT_KEY,
  APPLICATION_PURPOSE,
  APPLICATION_STEPS,
  APPLICATION_SUBTITLE,
  APPLICATION_SUCCESS_MESSAGE,
  APPLICATION_TITLE,
} from './applicationSchema'
import CityStateInput from './CityStateInput'
import {
  ChoiceInput,
  FileInput,
  LikertGroupInput,
  MultiSelectInput,
  SelectInput,
  RatingGroupInput,
  SentenceGroupInput,
  TextAreaInput,
  TextInput,
  YesNoGroupInput,
} from './fields'
import { submitApplication } from '../../services/careersApi'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\/.+/i

function StepIntro({ parts }) {
  return (
    <p className="text-[13px] leading-relaxed text-ink-muted">
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <Link
            key={`${part.label}-${index}`}
            to={part.to}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-secondary underline decoration-white/20 underline-offset-[3px] transition-colors hover:text-white hover:decoration-white/45"
          >
            {part.label}
          </Link>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  )
}

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(APPLICATION_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* corrupted draft, start fresh */
  }
  return null
}

function validateStep(step, values) {
  const errors = {}

  for (const field of step.fields) {
    const value = values[field.id]

    if (field.type === 'email' && value && !EMAIL_PATTERN.test(String(value).trim())) {
      errors[field.id] = 'Enter a valid email address.'
      continue
    }

    if (field.type === 'url' && value && !URL_PATTERN.test(String(value).trim())) {
      errors[field.id] = 'Enter a valid link starting with http:// or https://'
      continue
    }

    if (
      (field.type === 'select' || field.type === 'choice') &&
      value === 'Other' &&
      field.allowOther &&
      !String(values[`${field.id}__other`] ?? '').trim()
    ) {
      errors[field.id] = 'Please describe your selection.'
      continue
    }

    if (field.type === 'file' && value?.error) {
      errors[field.id] = value.error
      continue
    }

    if (field.type === 'sentenceGroup' && field.required) {
      const answers = value ?? {}
      if (!field.items.every(item => String(answers[item.id] ?? '').trim())) {
        errors[field.id] = 'Please complete each sentence.'
      }
      continue
    }

    if (
      field.required &&
      (field.type === 'ratingGroup' || field.type === 'likertGroup' || field.type === 'yesNoGroup')
    ) {
      const answers = value ?? {}
      if (!field.items.every(item => answers[item.id])) {
        errors[field.id] =
          field.type === 'yesNoGroup'
            ? 'Please answer every question.'
            : 'Please rate every statement.'
      }
      continue
    }

    if (!field.required) continue

    if (field.type === 'checkboxGroup') {
      const checks = value ?? {}
      if (!field.items.every(item => checks[item.id])) {
        errors[field.id] = 'Each statement must be acknowledged before submitting.'
      }
    } else if (field.type === 'multiselect' || (field.type === 'select' && field.multiple)) {
      if (!Array.isArray(value) || value.length === 0) {
        errors[field.id] = 'Choose at least one option.'
      } else if (field.maxSelections && value.length !== field.maxSelections) {
        errors[field.id] = `Choose exactly ${field.maxSelections} options.`
      }
    } else if (field.type === 'select' || field.type === 'choice') {
      if (!value) errors[field.id] = 'Choose an option.'
    } else if (!value || !String(value).trim()) {
      errors[field.id] = 'This field is required.'
    }
  }

  return errors
}

function ApplicationField({ field, values, errors, setValue }) {
  const value = values[field.id]
  const error = errors[field.id]
  const onChange = next => setValue(field.id, next)

  switch (field.type) {
    case 'textarea':
      return <TextAreaInput field={field} value={value} error={error} onChange={onChange} />
    case 'choice':
      return <ChoiceInput field={field} value={value} error={error} onChange={onChange} />
    case 'select':
      return (
        <SelectInput
          field={field}
          value={value}
          otherValue={values[`${field.id}__other`]}
          error={error}
          onChange={onChange}
          onOtherChange={next => setValue(`${field.id}__other`, next)}
        />
      )
    case 'multiselect':
      return (
        <MultiSelectInput
          field={field}
          value={value}
          otherValue={values[`${field.id}__other`]}
          error={error}
          onChange={onChange}
          onOtherChange={next => setValue(`${field.id}__other`, next)}
        />
      )
    case 'ratingGroup':
      return <RatingGroupInput field={field} value={value} error={error} onChange={onChange} />
    case 'likertGroup':
      return <LikertGroupInput field={field} value={value} error={error} onChange={onChange} />
    case 'yesNoGroup':
      return <YesNoGroupInput field={field} value={value} error={error} onChange={onChange} />
    case 'sentenceGroup':
      return <SentenceGroupInput field={field} value={value} error={error} onChange={onChange} />
    case 'file':
      return <FileInput field={field} value={value} error={error} onChange={onChange} />
    case 'cityState':
      return <CityStateInput field={field} value={value} error={error} onChange={onChange} />
    default:
      return <TextInput field={field} value={value} error={error} onChange={onChange} />
  }
}

function ProgressHeader({ stepIndex, maxVisitedIndex, onJump }) {
  const total = APPLICATION_STEPS.length
  const percent = Math.round(((stepIndex + 1) / total) * 100)

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            Step {stepIndex + 1} of {total}
          </p>
          <h2 className="mt-1.5 font-display text-lg font-medium tracking-tight text-white sm:text-xl">
            {APPLICATION_STEPS[stepIndex].title}
          </h2>
        </div>
        <div className="hidden shrink-0 gap-1.5 sm:flex" aria-hidden>
          {APPLICATION_STEPS.map((step, index) => {
            const reachable = index <= maxVisitedIndex
            return (
              <button
                key={step.id}
                type="button"
                tabIndex={-1}
                title={step.title}
                disabled={!reachable}
                onClick={() => reachable && onJump(index)}
                className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
                  index === stepIndex
                    ? 'bg-command-live'
                    : index <= maxVisitedIndex
                      ? 'bg-command-live/35 hover:bg-command-live/60'
                      : 'bg-[#222]'
                } ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
              />
            )
          })}
        </div>
      </div>
      <div className="mt-4 h-px w-full overflow-hidden rounded-full bg-[#1c1c1c] sm:hidden">
        <div
          className="h-full bg-command-live transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function SuccessPanel({ values }) {
  const name =
    values.preferredName ||
    [values.firstName, values.lastName].filter(Boolean).join(' ') ||
    ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl border border-command-stable/25 bg-panel-surface/40 p-8 sm:p-10"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-command-stable">
        Application received
      </p>
      <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-white">
        {name ? `Thank you, ${name}.` : 'Thank you.'}
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-secondary">
        {APPLICATION_SUCCESS_MESSAGE}
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
        You only need to begin.
      </p>
    </motion.div>
  )
}

export default function CareersView() {
  const [values, setValues] = useState(() => loadDraft() ?? {})
  const [stepIndex, setStepIndex] = useState(0)
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('editing')
  const [submitError, setSubmitError] = useState(null)
  const [honeypot, setHoneypot] = useState('')
  const formTopRef = useRef(null)

  const hadDraft = useMemo(() => loadDraft() !== null, [])

  const step = APPLICATION_STEPS[stepIndex]
  const isLastStep = stepIndex === APPLICATION_STEPS.length - 1

  useEffect(() => {
    if (status === 'success') return
    try {
      window.localStorage.setItem(APPLICATION_DRAFT_KEY, JSON.stringify(values))
    } catch {
      /* storage unavailable, draft autosave is best-effort */
    }
  }, [values, status])

  function setValue(id, next) {
    setValues(prev => ({ ...prev, [id]: next }))
    setErrors(prev => {
      if (!(id in prev)) return prev
      const rest = { ...prev }
      delete rest[id]
      return rest
    })
  }

  function scrollToForm() {
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function goToStep(index) {
    setErrors({})
    setStepIndex(index)
    setMaxVisitedIndex(prev => Math.max(prev, index))
    scrollToForm()
  }

  function handleNext() {
    const stepErrors = validateStep(step, values)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    goToStep(stepIndex + 1)
  }

  async function handleSubmit() {
    const stepErrors = validateStep(step, values)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }

    setStatus('submitting')
    setSubmitError(null)
    try {
      await submitApplication(values, { honeypot })
      try {
        window.localStorage.removeItem(APPLICATION_DRAFT_KEY)
      } catch {
        /* ignore */
      }
      setStatus('success')
      scrollToForm()
    } catch (err) {
      setStatus('editing')
      setSubmitError(err?.message ?? 'Submission failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-black font-sans text-ink-primary">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Careers at AXIOM
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
            {APPLICATION_TITLE}
          </h1>
          {APPLICATION_SUBTITLE ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-command-live/80">
              {APPLICATION_SUBTITLE}
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-secondary">
            {APPLICATION_PURPOSE}
          </p>
          {hadDraft && status !== 'success' ? (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Draft restored. Your answers save automatically on this device.
            </p>
          ) : null}
        </header>

        <div ref={formTopRef} className="scroll-mt-28" />

        <div className="mt-12">
          {status === 'success' ? (
            <SuccessPanel values={values} />
          ) : (
            <div className="relative rounded-2xl border border-panel-border bg-panel-bg/80 p-6 sm:p-8">
              <ProgressHeader
                stepIndex={stepIndex}
                maxVisitedIndex={maxVisitedIndex}
                onJump={goToStep}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  className="mt-7"
                >
                  {step.introParts ? (
                    <StepIntro parts={step.introParts} />
                  ) : step.intro ? (
                    <p className="text-[13px] leading-relaxed text-ink-muted">{step.intro}</p>
                  ) : null}

                  <div className={step.intro || step.introParts ? 'mt-7 space-y-7' : 'space-y-7'}>
                    {step.fields.map(field => (
                      <ApplicationField
                        key={field.id}
                        field={field}
                        values={values}
                        errors={errors}
                        setValue={setValue}
                      />
                    ))}
                  </div>

                  {isLastStep ? (
                    <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      Date: {new Date().toLocaleDateString()}
                    </p>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {/* Honeypot, invisible to people, attractive to bots */}
              <div className="absolute -left-[9999px] top-auto" aria-hidden>
                <label htmlFor="careers-website">Website</label>
                <input
                  id="careers-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                />
              </div>

              {Object.keys(errors).length > 0 ? (
                <p className="mt-6 font-mono text-[11px] text-command-critical" role="alert">
                  Some answers above need attention before continuing.
                </p>
              ) : null}

              {submitError ? (
                <div className="mt-6 rounded-lg border border-command-critical/30 bg-command-critical/5 px-4 py-3">
                  <p className="text-[13px] leading-relaxed text-command-critical">{submitError}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Your answers are saved on this device. Nothing was lost. Try again in a
                    moment.
                  </p>
                </div>
              ) : null}

              <div className="mt-9 flex items-center justify-between gap-3 border-t border-panel-border pt-6">
                <div>
                  {stepIndex > 0 ? (
                    <GhostButton onClick={() => goToStep(stepIndex - 1)}>Back</GhostButton>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:inline">
                    Answers autosave
                  </span>
                  {isLastStep ? (
                    <PrimaryButton onClick={handleSubmit} disabled={status === 'submitting'}>
                      {status === 'submitting' ? 'Submitting\u2026' : 'Submit application'}
                    </PrimaryButton>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-command-stable transition-colors hover:text-command-cyber"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
