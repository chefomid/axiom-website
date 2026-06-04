export function isPropertyIntelligenceEnabled() {
  if (import.meta.env.DEV) return true
  return import.meta.env.VITE_PROPERTY_INTELLIGENCE_ENABLED === 'true'
}
