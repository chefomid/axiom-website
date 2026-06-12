import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  acceptAll,
  applyGlobalPrivacyControlIfNeeded,
  getConsent,
  rejectNonEssential,
  saveCustomPreferences,
} from '../utils/cookieConsent'
import { syncAnalyticsConsent } from '../utils/analyticsLoader'

const ConsentContext = createContext(null)

export function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => {
    applyGlobalPrivacyControlIfNeeded()
    return getConsent()
  })
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  const refreshConsent = useCallback(() => {
    const next = getConsent()
    setConsent(next)
    syncAnalyticsConsent(Boolean(next?.analytics))
    return next
  }, [])

  useEffect(() => {
    syncAnalyticsConsent(Boolean(consent?.analytics))
  }, [consent])

  const handleAcceptAll = useCallback(() => {
    acceptAll()
    refreshConsent()
    setPreferencesOpen(false)
  }, [refreshConsent])

  const handleRejectNonEssential = useCallback(() => {
    rejectNonEssential()
    refreshConsent()
    setPreferencesOpen(false)
  }, [refreshConsent])

  const handleSavePreferences = useCallback(
    prefs => {
      saveCustomPreferences(prefs)
      refreshConsent()
      setPreferencesOpen(false)
    },
    [refreshConsent],
  )

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true)
  }, [])

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      consent,
      hasDecision: consent !== null,
      preferencesOpen,
      openPreferences,
      closePreferences,
      acceptAll: handleAcceptAll,
      rejectNonEssential: handleRejectNonEssential,
      savePreferences: handleSavePreferences,
    }),
    [
      consent,
      preferencesOpen,
      openPreferences,
      closePreferences,
      handleAcceptAll,
      handleRejectNonEssential,
      handleSavePreferences,
    ],
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsent() {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider')
  return ctx
}
