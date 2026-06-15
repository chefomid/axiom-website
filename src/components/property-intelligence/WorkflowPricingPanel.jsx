import { useMemo, useState } from 'react'
import { formatUsd } from '../../services/propertyApi'
import { buildSafeItemizedReceipt } from '../../utils/safeItemizedReceipt'
import ItemizedReceiptModal from './ItemizedReceiptModal'

export default function WorkflowPricingPanel({
  visible,
  loading,
  catalog,
  presets,
  activePresetId,
  quote,
  selectedSources,
  batchQuote,
  scheduleMode = false,
  isFinal = false,
}) {
  const [receiptOpen, setReceiptOpen] = useState(false)

  const receipt = useMemo(() => {
    if (!visible) return null
    return buildSafeItemizedReceipt({
      catalog,
      presets,
      activePresetId,
      quote,
      selectedSources,
      batchQuote,
      scheduleMode,
    })
  }, [visible, catalog, presets, activePresetId, quote, selectedSources, batchQuote, scheduleMode])

  if (!visible) return null

  const totalUsd = receipt?.totalUsd
  const totalLabel = isFinal ? 'Final total' : scheduleMode ? 'Schedule total' : 'Estimated total'
  const minimumApplied = scheduleMode && batchQuote?.totals?.minimum_charge_applied
  const priceDisplay = loading || totalUsd == null ? '…' : formatUsd(totalUsd)

  return (
    <>
      <div className="workflow-footer-pricing">
        <div className="workflow-footer-pricing__row">
          <div className="workflow-footer-pricing__main">
            <p className="workflow-footer-pricing__label">{totalLabel}</p>
            <p className="workflow-footer-pricing__amount">{priceDisplay}</p>
          </div>
          <button
            type="button"
            onClick={() => setReceiptOpen(true)}
            disabled={loading || totalUsd == null}
            className="workflow-footer-link"
          >
            View itemized receipt
          </button>
        </div>
        {minimumApplied && !loading ? (
          <p className="mt-1 font-mono text-[8px] leading-snug text-ink-faint">
            Includes schedule minimum for {batchQuote?.totals?.location_count ?? 1} location
            {(batchQuote?.totals?.location_count ?? 1) === 1 ? '' : 's'}.
          </p>
        ) : null}
      </div>

      <ItemizedReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={receipt}
        loading={loading}
      />
    </>
  )
}
