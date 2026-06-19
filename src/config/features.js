/**
 * Full Property Intelligence app: local dev only (desktop, 1024px+).
 * Production and preview builds show the overview / coming-soon preview unless
 * VITE_PROPERTY_INTELLIGENCE_ENABLED=true is set on the host (e.g. Vercel).
 */
export function isPropertyIntelligenceEnabled() {
  if (import.meta.env.DEV) return true
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_PROPERTY_INTELLIGENCE_ENABLED === 'true'
  }
  return false
}

/** LLM polish for careers dictation, off in production unless explicitly enabled with API keys. */
export function isCareersOrganizeLlmEnabled() {
  if (import.meta.env.DEV) return true
  return import.meta.env.VITE_CAREERS_ORGANIZE_LLM === 'true'
}

/**
 * Public Data Command: local dev only unless VITE_PUBLIC_DATA_COMMAND_ENABLED=true on the host.
 * Production shows a non-dismissible hold screen until the tool is ready.
 */
export function isPublicDataCommandEnabled() {
  if (import.meta.env.DEV) return true
  if (import.meta.env.PROD) {
    return (
      import.meta.env.VITE_PUBLIC_DATA_COMMAND_ENABLED === 'true' ||
      isPropertyIntelligenceEnabled()
    )
  }
  return false
}
