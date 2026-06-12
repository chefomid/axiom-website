import { formatUsd } from '../../services/propertyApi'
import { WORKFLOW_CTL } from './workflowControls'
import { emptyHint } from './workflowReceiptUtils'

function blockMessage({ address, locationLocked, generateBlockReason, hint }) {
  if (!address?.trim() || !locationLocked) return 'Choose location first'
  return generateBlockReason ?? hint
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
}) {
  const totals = quote?.totals
  const showGenerate = !hasReport
  const hint = emptyHint({ address, selectedCount, locationLocked, loading, quoteError, apiOnline })
  const isBlocked = generateDisabled || loadingReport
  const tooltip = blockMessage({ address, locationLocked, generateBlockReason, hint })
  const widthClass = fullWidth ? 'w-full' : ''
  const isIntelligence = variant === 'intelligence'

  if (!showGenerate) {
    if (isIntelligence) {
      return (
        <button type="button" disabled className={`side-panel-cta ${widthClass} opacity-50`}>
          Report Ready
        </button>
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
    if (isIntelligence) {
      return (
        <button type="button" disabled className={`side-panel-cta ${widthClass} opacity-70`}>
          Running Report…
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled
        className={`${WORKFLOW_CTL} ${widthClass} border-command-live/40 bg-command-live/10 text-command-live`}
      >
        Running…
      </button>
    )
  }

  const intelligenceLabel = totals
    ? `Generate Intelligence Report · ${formatUsd(totals.user_price_usd)}`
    : 'Generate Intelligence Report'

  return (
    <div className={`group relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-disabled={isBlocked}
        onClick={isBlocked ? undefined : onGenerate}
        className={
          isIntelligence
            ? `side-panel-cta ${widthClass} aria-disabled:cursor-not-allowed aria-disabled:border-white/10 aria-disabled:bg-white/20 aria-disabled:text-[#050505]/45`
            : `${WORKFLOW_CTL} ${widthClass} border-command-live/50 bg-command-live/20 text-command-live hover:bg-command-live/30 aria-disabled:border-panel-border aria-disabled:bg-panel-surface/30 aria-disabled:text-ink-faint`
        }
      >
        {isIntelligence ? intelligenceLabel : totals ? `Generate · ${formatUsd(totals.user_price_usd)}` : 'Generate'}
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
