import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import {
  fetchBillingBalance,
  fetchBillingPacks,
  formatUsd,
  startBillingCheckout,
} from '../../services/propertyApi'
import { getOrCreateAnonId } from '../../utils/anonId'
import { useCheckoutPay } from '../../hooks/useCheckoutPay'

export default function CreditsWallet({ apiOnline, onBalanceChange, align = 'right', compact = false }) {
  const { presentCheckout } = useCheckoutPay()
  const rootRef = useRef(null)
  const [balance, setBalance] = useState(null)
  const [packs, setPacks] = useState([])
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [open, setOpen] = useState(false)

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

  useEffect(() => {
    if (!open) return

    const onPointerDown = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleCheckout = packId => {
    const pack = packs.find(item => item.id === packId)
    setOpen(false)
    presentCheckout({
      title: pack?.label ?? 'Add credits',
      charge_usd: pack?.price_usd,
      credits_to_add: pack?.credits,
      fetchSession: embedded => startBillingCheckout(packId, anonId, { embedded }),
      onComplete: () => refresh(),
    })
  }

  if (!apiOnline || !billingEnabled) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="credits-wallet-panel"
        className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] transition-colors duration-300 ${
          compact ? 'text-[8px]' : 'text-[9px]'
        } ${open ? 'text-command-watch' : 'text-ink-muted hover:text-command-watch'}`}
      >
        <span>Credits</span>
        <span className="tabular-nums text-ink-faint">{balance ?? '…'}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close credits menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
              onClick={() => setOpen(false)}
            />
            <motion.div
              id="credits-wallet-panel"
              role="dialog"
              aria-label="Credits wallet"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className={`pi-search-dropdown-enter absolute top-full z-40 overflow-hidden rounded-xl border border-white/10 bg-panel-surface/95 shadow-2xl backdrop-blur-md [color-scheme:dark] ${
                compact ? 'mt-1.5' : 'mt-2'
              } w-[min(20rem,calc(100vw-2rem))] ${align === 'left' ? 'left-0' : 'right-0'}`}
            >
              <div className="border-b border-white/8 px-4 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                  Available balance
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold tabular-nums text-white">
                    {balance ?? 0}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    credits
                  </span>
                </p>
              </div>

              <div className="px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                  Top up
                </p>
                <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
                  Scan the QR code on your phone or pay with card on this device.
                </p>
              </div>

              <ul className="sleek-scrollbar max-h-[min(16rem,40vh)] divide-y divide-white/6 overflow-y-auto border-t border-white/8">
                {packs.map(pack => (
                    <li key={pack.id}>
                      <button
                        type="button"
                        onClick={() => handleCheckout(pack.id)}
                        className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[10px] text-white transition-colors group-hover:text-command-live">
                            {pack.label}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[9px] text-ink-faint">
                            {pack.credits} credits · {pack.description}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] tabular-nums text-command-live transition-colors group-hover:border-command-live/30 group-hover:bg-command-live/10">
                          {formatUsd(pack.price_usd)}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>

              <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="font-mono text-[9px] uppercase tracking-wider text-ink-faint transition-colors hover:text-white"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-mono text-[9px] uppercase tracking-wider text-ink-faint transition-colors hover:text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
