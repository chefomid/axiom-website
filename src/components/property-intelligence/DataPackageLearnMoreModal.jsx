import { motion, AnimatePresence } from 'framer-motion'

import { PrimaryButton } from '../ui/CommandControls'

export default function DataPackageLearnMoreModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="data-package-learn-more-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[240] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-md overflow-hidden rounded-t-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl md:rounded md:border"
            onClick={event => event.stopPropagation()}
          >
            <div className="p-5 md:p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-live">
                Data packages
              </p>
              <h2
                id="data-package-learn-more-title"
                className="font-display mt-1 text-lg font-semibold text-white"
              >
                What your package pulls
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-secondary">
                <li>
                  <span className="text-white">Publicly available:</span> live government hazard feeds,
                  COPE map layers, and public records where published.
                </li>
                <li>
                  <span className="text-white">Licensed tiers:</span> vendor property records, building
                  attributes, and peril scores on top of public feeds.
                </li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Each source has its own footprint and update cadence, so the same package can return
                more or less detail depending on the property. AXIOM labels every field verified,
                inferred, or missing so you see what actually came back.
              </p>
              <div className="mt-5 flex justify-end">
                <PrimaryButton onClick={onClose}>Got it</PrimaryButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
