import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { PrimaryButton } from '../ui/CommandControls'

export default function PublicDataCommandBlockedModal() {
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 z-[300] flex min-h-[100dvh] items-center justify-center bg-black/95 p-6 backdrop-blur-md">
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pdc-blocked-title"
        aria-describedby="pdc-blocked-desc"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md rounded-xl border border-[#333] bg-[#0d0d0d] p-6 shadow-2xl md:p-7"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-watch">Temporarily unavailable</p>
        <h1 id="pdc-blocked-title" className="font-display mt-2 text-xl font-semibold text-white">
          Public Data Command
        </h1>
        <p id="pdc-blocked-desc" className="mt-4 text-sm leading-relaxed text-ink-secondary">
          We&apos;re still finishing this workspace. It isn&apos;t open on the live site yet — check back soon or
          continue from the home page.
        </p>
        <div className="mt-6 flex justify-end">
          <Link to="/" className="no-underline">
            <PrimaryButton type="button">Back to home</PrimaryButton>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
