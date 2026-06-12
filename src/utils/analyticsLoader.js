const PLAUSIBLE_SCRIPT_ID = 'axiom-plausible-analytics'

function getPlausibleConfig() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim()
  const scriptUrl =
    import.meta.env.VITE_PLAUSIBLE_SCRIPT_URL?.trim() || 'https://plausible.io/js/script.js'
  if (!domain) return null
  return { domain, scriptUrl }
}

function removePlausibleScript() {
  const existing = document.getElementById(PLAUSIBLE_SCRIPT_ID)
  if (existing) existing.remove()
  delete window.plausible
}

export function syncAnalyticsConsent(analyticsAllowed) {
  if (!analyticsAllowed) {
    removePlausibleScript()
    return
  }

  const config = getPlausibleConfig()
  if (!config) return

  if (document.getElementById(PLAUSIBLE_SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = PLAUSIBLE_SCRIPT_ID
  script.defer = true
  script.dataset.domain = config.domain
  script.src = config.scriptUrl
  document.head.appendChild(script)
}
