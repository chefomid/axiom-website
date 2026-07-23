import { WORKFLOW_CTL } from './workflowControls'
import { emptyHint } from './workflowReceiptUtils'

function blockMessage({ address, locationLocked, generateBlockReason, hint, scheduleMode }) {
  if (scheduleMode) {
    if (!locationLocked) return 'Upload a schedule and choose a package first'
    return generateBlockReason ?? hint
  }
  if (!address?.trim() || !locationLocked) return 'Choose location first'
  return generateBlockReason ?? hint
}

function LoadingButtonContent({ label, variant = 'intelligence' }) {
  const spinnerClass =
    variant === 'intelligence'
      ? 'h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[rgba(232,168,56,0.22)] border-t-[rgba(232,168,56,0.9)]'
      : 'h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-command-live/30 border-t-command-live'

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className={spinnerClass} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

function ReportMeta({ title, dateLabel }) {
  if (!title && !dateLabel) return null
  return (
    <div className="min-w-0 flex-1 text-right">
      {title ? (
        <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-command-watch">
          {title}
        </p>
      ) : null}
      {dateLabel ? (
        <p className="mt-0.5 truncate font-mono text-[9px] text-ink-faint">{dateLabel}</p>
      ) : null}
    </div>
  )
}

function formatReportDate(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value instanceof Date ? value : new Date(value))
  } catch {
    return ''
  }
}

export default function WorkflowGenerateButton({
  quote,
  loading,
  onGenerate,
  generateDisabled,
  loadingReport,
  address,
  selectedCount = 0,
  locationLocked,
  quoteError,
  apiOnline,
  hasReport = false,
  generateBlockReason = null,
  enrichStatus = null,
  fullWidth = false,
  variant = 'default',
  billingEnabled: _billingEnabled = false,
  checkoutPreview: _checkoutPreview = null,
  payLoading = false,
  scheduleMode = false,
  hidePriceInLabel: _hidePriceInLabel = false,
  reportTitle = null,
  reportDate = null,
}) {
  const showGenerate = !hasReport
  const hint = emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline })
  const isBlocked = generateDisabled || loadingReport || loading
  const tooltip = blockMessage({ address, locationLocked, generateBlockReason, hint, scheduleMode })
  const isIntelligence = variant === 'intelligence'
  const dateLabel = formatReportDate(reportDate ?? new Date())
  const metaTitle =
    reportTitle ??
    (scheduleMode ? 'Schedule analysis' : null) ??
    (quote?.preset_label ?? null)

  const intelligenceBtnClass = 'workflow-footer-cta workflow-footer-cta--tab'

  const wrapClass = `group relative flex items-center gap-3 ${fullWidth || isIntelligence ? 'w-full' : ''}`

  if (!showGenerate) {
    if (isIntelligence) {
      return (
        <div className={wrapClass}>
          <span role="status" className="workflow-footer-cta workflow-footer-cta--ready workflow-footer-cta--tab">
            Report ready
          </span>
          <ReportMeta title={metaTitle} dateLabel={dateLabel} />
        </div>
      )
    }
    return (
      <span className={`${WORKFLOW_CTL} border-command-stable/40 bg-command-stable/10 text-command-stable`}>
        Ready
      </span>
    )
  }

  if (loadingReport || (enrichStatus && enrichStatus !== 'idle')) {
    const runningLabel = scheduleMode ? 'Analyzing…' : 'Running…'
    if (isIntelligence) {
      return (
        <div className={wrapClass}>
          <button
            type="button"
            disabled
            aria-busy="true"
            className={`${intelligenceBtnClass} workflow-footer-cta--busy`}
          >
            <LoadingButtonContent label={runningLabel} variant="intelligence" />
          </button>
          <ReportMeta title={metaTitle} dateLabel={dateLabel} />
        </div>
      )
    }
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className={`${WORKFLOW_CTL} border-command-live/40 bg-command-live/10 text-command-live`}
      >
        <LoadingButtonContent label="Running…" variant="default" />
      </button>
    )
  }

  if (payLoading) {
    if (isIntelligence) {
      return (
        <div className={wrapClass}>
          <button
            type="button"
            disabled
            aria-busy="true"
            className={`${intelligenceBtnClass} workflow-footer-cta--busy`}
          >
            <LoadingButtonContent label="Checkout…" variant="intelligence" />
          </button>
          <ReportMeta title={metaTitle} dateLabel={dateLabel} />
        </div>
      )
    }
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className={`${WORKFLOW_CTL} border-command-live/40 bg-command-live/10 text-command-live`}
      >
        <LoadingButtonContent label="Opening checkout…" variant="default" />
      </button>
    )
  }

  const defaultLabel = scheduleMode ? 'Analyze' : 'Generate report'

  if (isIntelligence) {
    return (
      <div className={wrapClass}>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-disabled={isBlocked}
            onClick={isBlocked ? undefined : onGenerate}
            className={intelligenceBtnClass}
          >
            {defaultLabel}
          </button>
          {isBlocked ? (
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-40 w-max max-w-[16rem] rounded-md border border-panel-border bg-[#0d0d0d] px-2.5 py-1.5 font-mono text-[9px] leading-snug text-ink-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            >
              {tooltip}
            </div>
          ) : null}
        </div>
        <ReportMeta title={metaTitle} dateLabel={dateLabel} />
      </div>
    )
  }

  return (
    <div className={`group relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-disabled={isBlocked}
        onClick={isBlocked ? undefined : onGenerate}
        className={`${WORKFLOW_CTL} ${fullWidth ? 'w-full' : ''} border-command-live/50 bg-command-live/20 text-command-live hover:bg-command-live/30 aria-disabled:border-panel-border aria-disabled:bg-panel-surface/30 aria-disabled:text-ink-faint`}
      >
        {defaultLabel}
      </button>
      {isBlocked ? (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-40 w-max max-w-[16rem] rounded-md border border-panel-border bg-[#0d0d0d] px-2.5 py-1.5 font-mono text-[9px] leading-snug text-ink-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 ${
            fullWidth ? 'left-0 top-auto bottom-[calc(100%+6px)]' : 'right-0 top-[calc(100%+6px)]'
          }`}
        >
          {tooltip}
        </div>
      ) : null}
    </div>
  )
}
