import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SCREENSHOTS = [
  {
    src: '/assistant/workspace.png',
    title: 'Capture workspace',
    caption: 'Waveform review, structured reports, and full transcripts in one session.',
  },
  {
    src: '/assistant/chat-report.png',
    title: 'Assistant chat',
    caption: 'Ask over any recording and export decisions, themes, and follow-ups.',
  },
  {
    src: '/assistant/library.png',
    title: 'Library',
    caption: 'Search captures, filter by date, and bundle audio, transcripts, and chat.',
  },
]

export default function AssistantModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="assistant-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#3a3a3a] bg-[#141414] shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#2d2d2d] px-4 py-3">
              <div className="min-w-0">
                <p
                  id="assistant-modal-title"
                  className="font-display text-sm font-semibold text-white sm:text-base"
                >
                  AXIOM Assistant
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                  Plug and play capture with a shared knowledge corpus across the stack.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="im-accent-close flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#333]"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path
                    d="M4 4l10 10M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                {SCREENSHOTS.map(item => (
                  <figure
                    key={item.src}
                    className="overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#1c1c1c]"
                  >
                    <figcaption className="space-y-0.5 border-b border-[#d4d4d4] bg-white px-3 py-2.5">
                      <p className="font-display text-[12px] font-semibold text-[#141414]">{item.title}</p>
                      <p className="text-[10px] leading-relaxed text-[#5c5c5c]">{item.caption}</p>
                    </figcaption>
                    <div className="bg-[#242424] p-1.5">
                      <img
                        src={item.src}
                        alt={item.title}
                        className="block w-full rounded-sm object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
