/** Live hazard map, government & open-data feeds */
export const PUBLIC_DATA_COMMAND_PATH = '/public-data-command'
export const PUBLIC_DATA_COMMAND_LABEL = 'Public Data Command'

/** Address / property enrichment (Crawl4AI-backed API) */
export const PROPERTY_INTELLIGENCE_PATH = '/property-intelligence'
export const PROPERTY_INTELLIGENCE_LABEL = 'Property Intelligence'

/** Playwright PDF print preview (no chrome) */
export const REPORT_PRINT_PATH = '/reports/print/:sessionId'

/** Careers admin console (token-gated) */
export const CAREERS_ADMIN_PATH = '/careers/admin'

/** Careers, AXIOM / ATLAS development application */
export const CAREERS_PATH = '/careers'
export const CAREERS_LABEL = 'Careers'

/** Legal / privacy */
export const PRIVACY_POLICY_PATH = '/privacy'
export const COOKIE_POLICY_PATH = '/cookies'

/** Easter egg: A Better World vision (careers application link only) */
export const MISSION_PATH = '/mission'

/** Legacy URLs (redirect targets) */
export const LEGACY_IMPACT_MAP_PATH = '/impact-map'
export const LEGACY_BETTER_WORLD_PATH = '/a-better-world'

/** Deep-link Public Data Command to a lat/lng (local scope). */
export function publicDataCommandAtLocation(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    scope: 'local',
  })
  return `${PUBLIC_DATA_COMMAND_PATH}?${params}`
}
