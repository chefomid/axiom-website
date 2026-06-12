import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GhostButton, PanelToggle, PrimaryButton } from '../ui/CommandControls'
import { useConsent } from '../../context/ConsentContext'

const CATEGORIES = [
  {
    id: 'necessary',
    label: 'Necessary cookies',
    meta: 'Required for the website to work. These cannot be turned off.',
    locked: true,
  },
  {
    id: 'analytics',
    label: 'Analytics cookies',
    meta: 'Help us understand how visitors use the site so we can improve pages and content. Uses Plausible Analytics (no personal data or tracking cookies).',
    locked: false,
  },
  {
    id: 'marketing',
    label: 'Marketing cookies',
    meta: 'Help us measure ads or show relevant content across websites. No marketing trackers are active today.',
    locked: false,
  },
]

export default function CookiePreferencesModal({ open, onClose, initialMarketingOff = false }) {
  const { consent, acceptAll, rejectNonEssential, savePreferences } = useConsent()
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (!open) return
    setAnalytics(Boolean(consent?.analytics))
    setMarketing(initialMarketingOff ? false : Boolean(consent?.marketing))
  }, [open, consent, initialMarketingOff])

  const handleSave = () => {
    savePreferences({ analytics, marketing })
  }

  const handleDoNotSell = () => {
    savePreferences({ analytics, marketing: false })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-prefs-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-lg rounded border border-[#333] bg-[#0d0d0d]/98 p-5 shadow-2xl sm:p-6"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
              Privacy preferences
            </p>
            <h2
              id="cookie-prefs-title"
              className="mt-2 font-display text-lg font-medium tracking-tight text-white"
            >
              Manage cookie preferences
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Choose which categories of cookies and similar technologies you allow. You can change
              these settings at any time.
            </p>

            <div className="mt-5 space-y-1 rounded border border-[#2a2a2a] bg-[#0a0a0a]/60 p-2">
              {CATEGORIES.map(cat => {
                const active =
                  cat.id === 'necessary'
                    ? true
                    : cat.id === 'analytics'
                      ? analytics
                      : marketing
                const onClick = () => {
                  if (cat.locked) return
                  if (cat.id === 'analytics') setAnalytics(v => !v)
                  if (cat.id === 'marketing') setMarketing(v => !v)
                }
                return (
                  <PanelToggle
                    key={cat.id}
                    active={active}
                    onClick={onClick}
                    label={cat.label}
                    meta={cat.locked ? `${cat.meta} Always on.` : cat.meta}
                    accent={cat.locked ? 'stable' : 'live'}
                  />
                )
              })}
            </div>

            <div className="mt-4 rounded border border-[#2a2a2a] bg-[#0a0a0a]/60 px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                Your privacy choices
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                AXIOM does not sell your personal information. California residents can turn off
                marketing-related preferences here. This also satisfies CCPA opt-out rights for data
                sharing used in targeted advertising.
              </p>
              <button
                type="button"
                onClick={handleDoNotSell}
                className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary underline decoration-[#444] underline-offset-2 transition-colors hover:text-white"
              >
                Turn off marketing preferences
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <GhostButton onClick={rejectNonEssential}>Reject non-essential</GhostButton>
              <GhostButton onClick={acceptAll}>Accept all</GhostButton>
              <PrimaryButton onClick={handleSave}>Save preferences</PrimaryButton>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-white"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
