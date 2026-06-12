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

/** LLM polish for careers dictation — off in production unless explicitly enabled with API keys. */
export function isCareersOrganizeLlmEnabled() {
  if (import.meta.env.DEV) return true
  return import.meta.env.VITE_CAREERS_ORGANIZE_LLM === 'true'
}
