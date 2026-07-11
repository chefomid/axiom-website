/** Live hazard map, government & open-data feeds */
export const PUBLIC_DATA_COMMAND_PATH = '/public-data-command'
export const PUBLIC_DATA_COMMAND_LABEL = 'Public Data Command'

/** USGS seismic / EQ frequency analysis (under Public Data Command) */
export const EARTHQUAKE_ANALYSIS_PATH = '/earthquake-analysis'
export const EARTHQUAKE_ANALYSIS_LABEL = 'Seismic/EQ Analysis'

/** Address / property enrichment (Crawl4AI-backed API) */
export const PROPERTY_INTELLIGENCE_PATH = '/property-intelligence'
export const PROPERTY_INTELLIGENCE_LABEL = 'Property Intelligence'

/** Playwright PDF print preview (no chrome) */
export const REPORT_PRINT_PATH = '/reports/print/:sessionId'

/** Careers admin console (token-gated) */
export const CAREERS_ADMIN_PATH = '/careers/admin'

/** Careers, AXIOM / ATLAS development application */
export const CAREERS_PATH = '/careers'
export const CAREERS_LABEL = 'Contribute'

/** Legal / privacy */
export const PRIVACY_POLICY_PATH = '/privacy'
export const COOKIE_POLICY_PATH = '/cookies'

/** Easter egg: A Better World vision (careers application link only) */
export const MISSION_PATH = '/mission'

/** Legacy URLs (redirect targets) */
export const LEGACY_IMPACT_MAP_PATH = '/impact-map'
export const LEGACY_BETTER_WORLD_PATH = '/a-better-world'

/** Marketing site canonical URL */
export const MARKETING_SITE_URL = 'https://www.axiompropertycasualty.com'

/** Live COI Tracker interactive demo (separate deployed app) */
export const COI_TRACKER_DEMO_URL =
  import.meta.env.VITE_COI_TRACKER_DEMO_URL?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:5180' : '')

/** Deep-link Public Data Command to a lat/lng (local scope). */
export function publicDataCommandAtLocation(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    scope: 'local',
  })
  return `${PUBLIC_DATA_COMMAND_PATH}?${params}`
}

/** Deep-link Seismic/EQ Analysis to a lat/lng (optional label). */
export function earthquakeAnalysisAtLocation(lat, lng, label) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  })
  if (label?.trim()) params.set('label', label.trim())
  return `${EARTHQUAKE_ANALYSIS_PATH}?${params}`
}
