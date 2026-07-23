import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COUNTRIES, RADIUS_OPTIONS, SCOPE_MODES } from '../../data/commandMapData'
import { GhostButton, PrimaryButton, SegmentButton } from '../ui/CommandControls'

export default function ScopeSetupModal({
  open,
  onApply,
  onClose,
  initialScope = 'national',
  initialRadiusMiles = 50,
  initialCountryId = 'US',
  initialUserLocation = null,
}) {
  const [scope, setScope] = useState(initialScope)
  const [radiusMiles, setRadiusMiles] = useState(initialRadiusMiles)
  const [countryId, setCountryId] = useState(initialCountryId)
  const [countryQuery, setCountryQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [useDeviceLocation, setUseDeviceLocation] = useState(false)

  useEffect(() => {
    if (!open) return
    setScope(initialScope)
    setRadiusMiles(initialRadiusMiles)
    setCountryId(initialCountryId)
    setCountryQuery('')
    setLocationError('')
    setUseDeviceLocation(false)
  }, [open, initialScope, initialRadiusMiles, initialCountryId])

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.label.toLowerCase().includes(q))
  }, [countryQuery])

  const hasPinnedLocation = Boolean(initialUserLocation)
  const keepPinnedLocation = scope === 'local' && hasPinnedLocation && !useDeviceLocation

  const requestLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported in this browser.'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 12000 },
      )
    })

  const handleApply = async () => {
    setLocationError('')
    let userLocation = null

    if (scope === 'local') {
      if (keepPinnedLocation) {
        userLocation = initialUserLocation
      } else {
        setLocating(true)
        try {
          userLocation = await requestLocation()
        } catch {
          setLocationError(
            'Unable to access your location. Choose National or Global, or allow location access and retry.',
          )
          setLocating(false)
          return
        }
        setLocating(false)
      }
    }

    onApply({ scope, radiusMiles, countryId, userLocation })
    onClose()
  }

  const applyLabel = () => {
    if (locating) return 'Locating...'
    if (scope === 'local' && !keepPinnedLocation) return 'Use my location'
    return 'Apply scope'
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-md rounded border border-[#333] bg-[#0d0d0d]/98 p-5 shadow-2xl"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Operational Scope</p>
            <h2 className="font-display mt-1 text-lg font-semibold text-white">Set your command view</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Choose a local radius from the map pin, filter to a country, or view global events.
            </p>

            <div className="mt-5 flex gap-2">
              {SCOPE_MODES.map(mode => (
                <SegmentButton
                  key={mode.id}
                  active={scope === mode.id}
                  onClick={() => setScope(mode.id)}
                >
                  {mode.label}
                </SegmentButton>
              ))}
            </div>

            {scope === 'local' && (
              <div className="mt-5 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Radius from map pin
                </p>
                <div className="flex flex-wrap gap-2">
                  {RADIUS_OPTIONS.map(r => (
                    <SegmentButton
                      key={r}
                      className="!min-h-[36px] !flex-none px-4"
                      active={radiusMiles === r}
                      onClick={() => setRadiusMiles(r)}
                    >
                      {r} mi
                    </SegmentButton>
                  ))}
                </div>

                {hasPinnedLocation ? (
                  <div className="space-y-2 rounded border border-[#2a2a2a] bg-[#111] px-3 py-2.5">
                    <p className="font-mono text-[10px] leading-relaxed text-ink-secondary">
                      {keepPinnedLocation
                        ? 'Keeping the current pin (property or map location). Radius changes will not move it.'
                        : 'Apply will request your device location and replace the current pin.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setUseDeviceLocation(v => !v)}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-cyber transition hover:text-white"
                    >
                      {keepPinnedLocation ? 'Use my device location instead' : 'Keep current map pin'}
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-[10px] text-ink-faint">
                    Your browser will request location permission when you apply this scope.
                  </p>
                )}
              </div>
            )}

            {scope === 'national' && (
              <div className="mt-5 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Country</p>
                <input
                  type="search"
                  value={countryQuery}
                  onChange={e => setCountryQuery(e.target.value)}
                  placeholder="Search countries..."
                  className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-[#444] focus:outline-none"
                />
                <select
                  value={countryId}
                  onChange={e => setCountryId(e.target.value)}
                  className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white focus:border-[#444] focus:outline-none"
                >
                  {filteredCountries.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'global' && (
              <p className="mt-5 font-mono text-[11px] leading-relaxed text-ink-secondary">
                All events across every region and data source will be visible on the map.
              </p>
            )}

            {locationError && (
              <p className="mt-4 font-mono text-[10px] text-command-watch">{locationError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <PrimaryButton onClick={handleApply} disabled={locating}>
                {applyLabel()}
              </PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
