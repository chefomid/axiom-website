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
}) {
  const showGenerate = !hasReport
  const hint = emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline })
  const isBlocked = generateDisabled || loadingReport || loading
  const tooltip = blockMessage({ address, locationLocked, generateBlockReason, hint, scheduleMode })
  const widthClass = fullWidth ? 'w-full' : ''
  const isIntelligence = variant === 'intelligence'

  if (!showGenerate) {
    if (isIntelligence) {
      return (
        <span
          role="status"
          className={`workflow-footer-cta workflow-footer-cta--ready ${widthClass}`}
        >
          Report ready
        </span>
      )
    }
    return (
      <span
        className={`${WORKFLOW_CTL} ${widthClass} border-command-stable/40 bg-command-stable/10 text-command-stable`}
      >
        Ready
      </span>
    )
  }

  if (loadingReport || (enrichStatus && enrichStatus !== 'idle')) {
    const runningLabel = scheduleMode ? 'Analyzing schedule…' : 'Running report…'
    if (isIntelligence) {
      return (
        <button
          type="button"
          disabled
          aria-busy="true"
          className={`workflow-footer-cta workflow-footer-cta--busy ${widthClass}`}
        >
          <LoadingButtonContent label={runningLabel} variant="intelligence" />
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className={`${WORKFLOW_CTL} ${widthClass} border-command-live/40 bg-command-live/10 text-command-live`}
      >
        <LoadingButtonContent label="Running…" variant="default" />
      </button>
    )
  }

  if (payLoading) {
    if (isIntelligence) {
      return (
        <button
          type="button"
          disabled
          aria-busy="true"
          className={`workflow-footer-cta workflow-footer-cta--busy ${widthClass}`}
        >
          <LoadingButtonContent label="Opening checkout…" variant="intelligence" />
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className={`${WORKFLOW_CTL} ${widthClass} border-command-live/40 bg-command-live/10 text-command-live`}
      >
        <LoadingButtonContent label="Opening checkout…" variant="default" />
      </button>
    )
  }

  const defaultLabel = scheduleMode ? 'Analyze schedule' : 'Generate'

  return (
    <div className={`group relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-disabled={isBlocked}
        onClick={isBlocked ? undefined : onGenerate}
        className={
          isIntelligence
            ? `workflow-footer-cta ${widthClass}`
            : `${WORKFLOW_CTL} ${widthClass} border-command-live/50 bg-command-live/20 text-command-live hover:bg-command-live/30 aria-disabled:border-panel-border aria-disabled:bg-panel-surface/30 aria-disabled:text-ink-faint`
        }
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
