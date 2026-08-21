import { motion, AnimatePresence } from 'framer-motion'

export const FIRE_PREVIEW_NOTICE_KEY = 'axiom:fire-preview-notice-ack'

export function isFirePreviewNoticeAcked() {
  try {
    return sessionStorage.getItem(FIRE_PREVIEW_NOTICE_KEY) === 'true'
  } catch {
    return false
  }
}

export function ackFirePreviewNotice() {
  try {
    sessionStorage.setItem(FIRE_PREVIEW_NOTICE_KEY, 'true')
  } catch {
    /* sessionStorage unavailable */
  }
}

export default function FirePreviewNoticeModal({ open, onContinue, onCancel }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fire-preview-notice-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[240] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm md:items-center md:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-md overflow-hidden rounded-t-xl border border-[#e5e5e5] bg-white shadow-2xl md:rounded-xl [color-scheme:light]"
          >
            <div className="p-5 md:p-6">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#c4841f]">
                Web preview
              </p>
              <h2
                id="fire-preview-notice-title"
                className="font-display mt-1 text-lg font-semibold text-[#141414]"
              >
                Fire &amp; Hotspots preview
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#333]">
                Map, live feeds, and schedule upload work in this preview. Pin locations, explore
                hotspots, and watch wind and radius tools in action.
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-[#666]">
                Full functionality, including global data coverage and the alerting system, is not
                available on this website. Those capabilities are part of AXIOM&apos;s risk management
                platform.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-[#d0d0d0] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#555] transition hover:border-[#999] hover:text-[#141414]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onContinue}
                  className="rounded-lg border border-[#d4922a] bg-[#e8a838] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#141414] transition hover:bg-[#f0b040]"
                >
                  Continue to preview
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
