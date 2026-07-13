import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EarthquakeAnalysisModal from '../components/better-world/EarthquakeAnalysisModal'
import EarthquakeAnalysisOverview from '../components/better-world/EarthquakeAnalysisOverview'
import PublicDataCommandBlockedModal from '../components/better-world/PublicDataCommandBlockedModal'
import { isPublicDataCommandEnabled } from '../config/features'
import { useIsLgUp } from '../hooks/useMediaQuery'

function parseCenterOverride(searchParams) {
  const lat = Number.parseFloat(searchParams.get('lat') ?? '')
  const lng = Number.parseFloat(searchParams.get('lng') ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const label = searchParams.get('label')?.trim()
  return {
    lat,
    lng,
    label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  }
}

/**
 * Standalone Seismic/EQ Analysis page (under Public Data Command).
 * Mobile/tablet: information overview only (workspace needs desktop width).
 */
export default function EarthquakeAnalysis() {
  const enabled = isPublicDataCommandEnabled()
  const isLgUp = useIsLgUp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initialCenterOverride = useMemo(
    () => parseCenterOverride(searchParams),
    [searchParams],
  )

  const countryId = searchParams.get('country')?.trim() || 'US'
  const magRaw = Number.parseFloat(searchParams.get('mag') ?? '')
  const initialMinMagnitude = Number.isFinite(magRaw) ? magRaw : 2.5

  useEffect(() => {
    document.title = 'Seismic/EQ Analysis | AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  if (!enabled) {
    return <PublicDataCommandBlockedModal />
  }

  if (!isLgUp) {
    return <EarthquakeAnalysisOverview />
  }

  return (
    <EarthquakeAnalysisModal
      open
      onClose={() => navigate('/')}
      scope="national"
      userLocation={null}
      countryId={countryId}
      initialMinMagnitude={initialMinMagnitude}
      initialCenterOverride={initialCenterOverride}
    />
  )
}
