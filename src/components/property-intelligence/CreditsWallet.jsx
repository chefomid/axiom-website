import { useCallback, useEffect, useState } from 'react'

import {
  fetchBillingBalance,
  fetchBillingPacks,
  formatUsd,
  startBillingCheckout,
} from '../../services/propertyApi'
import { getOrCreateAnonId } from '../../utils/anonId'

export default function CreditsWallet({ apiOnline, onBalanceChange }) {
  const [balance, setBalance] = useState(null)
  const [packs, setPacks] = useState([])
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkoutPack, setCheckoutPack] = useState(null)

  const anonId = getOrCreateAnonId()

  const refresh = useCallback(async () => {
    if (!apiOnline) {
      setBalance(null)
      return
    }
    try {
      const packsRes = await fetchBillingPacks()
      setPacks(packsRes.packs ?? [])
      setBillingEnabled(Boolean(packsRes.billing_enabled))
      if (packsRes.billing_enabled) {
        const bal = await fetchBillingBalance(anonId)
        setBalance(bal.balance_credits ?? 0)
        onBalanceChange?.(bal.balance_credits ?? 0, true)
      } else {
        setBalance(null)
        onBalanceChange?.(null, false)
      }
    } catch {
      setBalance(null)
      onBalanceChange?.(null, false)
    }
  }, [apiOnline, anonId, onBalanceChange])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onRefresh = () => refresh()
    window.addEventListener('axiom:billing-refresh', onRefresh)
    return () => window.removeEventListener('axiom:billing-refresh', onRefresh)
  }, [refresh])

  const handleCheckout = async packId => {
    setCheckoutPack(packId)
    setLoading(true)
    try {
      const { url } = await startBillingCheckout(packId, anonId)
      if (url) window.location.href = url
    } catch {
      setLoading(false)
      setCheckoutPack(null)
    }
  }

  if (!apiOnline || !billingEnabled) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded border border-panel-border bg-panel-surface/50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-ink-secondary transition hover:border-command-live/40 hover:text-white"
        title="Prepaid credits balance"
      >
        <span className="text-ink-muted">Credits</span>
        <span className="tabular-nums text-command-live">{balance ?? '…'}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded border border-panel-border bg-panel-bg p-3 shadow-xl">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">Add credits</p>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-white">
            Balance: {balance ?? 0} credits
          </p>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
            Pay on your phone (Apple Pay, Google Pay, card). No account required.
          </p>
          <ul className="mt-3 space-y-2">
            {packs.map(pack => (
              <li key={pack.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCheckout(pack.id)}
                  className="flex w-full items-center justify-between gap-2 rounded border border-panel-border bg-panel-surface/40 px-3 py-2 text-left transition hover:border-command-live/40 disabled:opacity-40"
                >
                  <span>
                    <span className="block font-mono text-[10px] text-white">{pack.label}</span>
                    <span className="block font-mono text-[9px] text-ink-faint">
                      {pack.credits} credits · {pack.description}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-command-live">
                    {checkoutPack === pack.id && loading ? '…' : formatUsd(pack.price_usd)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-2 font-mono text-[9px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"
          >
            Refresh balance
          </button>
        </div>
      ) : null}
    </div>
  )
}
