import { GhostButton, PrimaryButton } from '../ui/CommandControls'
import { useConsent } from '../../context/ConsentContext'

export default function CookieBanner() {
  const { hasDecision, acceptAll, rejectNonEssential, openPreferences } = useConsent()

  if (hasDecision) return null

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#333] bg-[#0a0a0a]/95 px-3 py-2 backdrop-blur-md sm:px-4"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p
            id="cookie-banner-title"
            className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink-muted"
          >
            Cookie preferences
          </p>
          <p id="cookie-banner-desc" className="mt-0.5 text-xs leading-snug text-ink-secondary">
            We use cookies to operate this site and improve our content. Change your choices anytime
            in Cookie Settings.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 [&_button]:min-h-8 [&_button]:px-3 [&_button]:py-1 [&_button]:text-[10px]">
          <PrimaryButton onClick={acceptAll}>Accept all</PrimaryButton>
          <GhostButton onClick={rejectNonEssential}>Reject non-essential</GhostButton>
          <GhostButton onClick={openPreferences}>Manage preferences</GhostButton>
        </div>
      </div>
    </div>
  )
}
