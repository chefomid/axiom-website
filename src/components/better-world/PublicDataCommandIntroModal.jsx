import { motion, AnimatePresence } from 'framer-motion'
import { PrimaryButton } from '../ui/CommandControls'

export const PDC_INTRO_ACK_KEY = 'axiom:pdc-intro-ack'

export function isPublicDataCommandIntroAcked() {
  try {
    return sessionStorage.getItem(PDC_INTRO_ACK_KEY) === 'true'
  } catch {
    return false
  }
}

export function ackPublicDataCommandIntro() {
  try {
    sessionStorage.setItem(PDC_INTRO_ACK_KEY, 'true')
  } catch {
    /* sessionStorage unavailable */
  }
}

export default function PublicDataCommandIntroModal({ open, onContinue, isMobile = false }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdc-intro-title"
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
              Government &amp; open-data intelligence
            </p>
            <h2
              id="pdc-intro-title"
              className="font-display mt-1 text-xl font-semibold text-white sm:text-2xl"
            >
              Public Data Command
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              Public Data Command maps live hazard signals from government and open-data feeds, including
              earthquakes, weather warnings, wildfire activity, flood zones, and related public layers, so you
              can scan conditions by scope without uploading portfolios or proprietary schedules of values.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Sources: USGS, NWS, FEMA, NASA
            </p>

            {isMobile && (
              <div className="mt-5 rounded border border-[#333] bg-[#141414] px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white">
                  Mobile view
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary">
                  Browse live hazard signals and filter by region. The interactive map, pin analysis, and
                  earthquake analytics are available on{' '}
                  <span className="text-white">desktop</span> (screen width 1024px or larger).
                </p>
              </div>
            )}

            <div className="mt-5 rounded border border-amber-900/40 bg-amber-950/20 px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-200/90">
                Public data disclaimer
              </p>
              <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-ink-muted">
                <li>
                  Feeds are aggregated from third-party public sources (e.g. USGS, NWS, NASA, FEMA). AXIOM does
                  not operate those agencies and does not guarantee completeness, accuracy, or timeliness.
                </li>
                <li>
                  Displayed events and zones may be delayed, revised, or geospatially approximate. They are for
                  situational awareness only, not official emergency instructions, engineering findings, or
                  underwriting determinations.
                </li>
                <li>
                  Always verify critical decisions with authoritative local alerts, licensed professionals, and
                  carrier-accepted data before acting on exposure or coverage.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex justify-end">
              <PrimaryButton onClick={onContinue}>
                {isMobile ? 'View live feed' : 'Continue to map'}
              </PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
