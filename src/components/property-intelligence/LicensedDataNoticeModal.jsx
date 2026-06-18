import { motion, AnimatePresence } from 'framer-motion'

import { PrimaryButton } from '../ui/CommandControls'

export const PI_LICENSED_NOTICE_KEY = 'axiom:pi-licensed-notice-ack'

export const LICENSED_PRESET_IDS = new Set(['cope_insurance', 'property_basics'])

export function isLicensedDataNoticeAcked() {
  try {
    return sessionStorage.getItem(PI_LICENSED_NOTICE_KEY) === 'true'
  } catch {
    return false
  }
}

export function ackLicensedDataNotice() {
  try {
    sessionStorage.setItem(PI_LICENSED_NOTICE_KEY, 'true')
  } catch {
    /* sessionStorage unavailable */
  }
}

export function isLicensedCatalogSource(catalog, sourceId) {
  const src = catalog?.sources?.find(item => item.id === sourceId)
  if (!src) return false
  return Boolean(src.requires_api_key || src.tier === 'insurance')
}

export default function LicensedDataNoticeModal({ open, onContinue }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pi-licensed-notice-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[240] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-md overflow-hidden rounded-t-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl md:rounded md:border"
          >
            <div className="p-5 md:p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-live">
                Licensed data
              </p>
              <h2
                id="pi-licensed-notice-title"
                className="font-display mt-1 text-lg font-semibold text-white"
              >
                Quick heads-up
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Licensed vendors cover 140M+ US properties, but some fields may still be blank for
                normal reasons: new builds, privacy rules, vendor gaps, or update lag.
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
                Every field is labeled verified, inferred, or missing. You only pay vendor
                pass-through on sources that actually run.
              </p>
              <div className="mt-5 flex justify-end">
                <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
