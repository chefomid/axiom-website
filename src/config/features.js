/**
 * Full Property Intelligence app — local Vite dev only.
 * Production and preview builds show the coming-soon page unless
 * VITE_PROPERTY_INTELLIGENCE_ENABLED=true is set on the host (e.g. Vercel).
 */
export function isPropertyIntelligenceEnabled() {
  if (import.meta.env.DEV) return true
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_PROPERTY_INTELLIGENCE_ENABLED === 'true'
  }
  return false
}
