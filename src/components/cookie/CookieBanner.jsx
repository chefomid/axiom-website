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
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#333] bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur-md sm:px-4 sm:py-2"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 sm:flex-1">
          <p
            id="cookie-banner-title"
            className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink-muted"
          >
            Cookie preferences
          </p>
          <p id="cookie-banner-desc" className="mt-1 text-xs leading-relaxed text-ink-secondary sm:mt-0.5 sm:leading-snug">
            We use cookies to operate this site and improve our content. Change your choices anytime
            in Cookie Settings.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-1.5 [&_button]:min-h-9 [&_button]:w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[10px] sm:[&_button]:min-h-8 sm:[&_button]:w-auto sm:[&_button]:py-1">
          <PrimaryButton onClick={acceptAll}>Accept all</PrimaryButton>
          <GhostButton onClick={rejectNonEssential}>Reject non-essential</GhostButton>
          <GhostButton onClick={openPreferences}>Manage preferences</GhostButton>
        </div>
      </div>
    </div>
  )
}
