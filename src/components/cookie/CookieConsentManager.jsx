import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { OPEN_PREFERENCES_EVENT } from '../../utils/cookieConsent'
import { useConsent } from '../../context/ConsentContext'
import CookieBanner from './CookieBanner'
import CookiePreferencesModal from './CookiePreferencesModal'

function isPrintRoute(pathname) {
  return pathname.startsWith('/reports/print/')
}

export default function CookieConsentManager() {
  const { pathname } = useLocation()
  const { preferencesOpen, openPreferences, closePreferences } = useConsent()
  const [marketingOff, setMarketingOff] = useState(false)

  useEffect(() => {
    const handleOpen = event => {
      const marketingOffRequested = Boolean(event.detail?.marketingOff)
      setMarketingOff(marketingOffRequested)
      openPreferences()
    }

    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpen)
  }, [openPreferences])

  if (isPrintRoute(pathname)) return null

  return (
    <>
      <CookieBanner />
      <CookiePreferencesModal
        open={preferencesOpen}
        onClose={closePreferences}
        initialMarketingOff={marketingOff}
      />
    </>
  )
}

export function openCookieSettings({ marketingOff = false } = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(OPEN_PREFERENCES_EVENT, { detail: { marketingOff } }),
  )
}

export function openDoNotSellOrShare() {
  openCookieSettings({ marketingOff: true })
}
