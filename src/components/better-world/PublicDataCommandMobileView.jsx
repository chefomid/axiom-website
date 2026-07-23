import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  COUNTRIES,
  DATA_SOURCES,
  RADIUS_OPTIONS,
  RISK_LAYERS,
  SCOPE_MODES,
} from '../../data/commandMapData'
import FeedStatusBar from './FeedStatusBar'
import IntelligencePanel from './IntelligencePanel'
import { SegmentButton, ToggleChip } from '../ui/CommandControls'
import StatusChip from './StatusChip'

const PEEK_BAR_HEIGHT = '4.25rem'

function requestLocation() {
  return new Promise((resolve, reject) => {
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
}

function MobileFilterPanel({
  draftScope,
  draftRadius,
  draftCountryId,
  countryQuery,
  setCountryQuery,
  filteredCountries,
  locating,
  locationError,
  userLocation,
  activeLayers,
  activeDataSources,
  layerLoading,
  feedStatus,
  onApplyScope,
  onApplyCountry,
  onApplyRadius,
  onToggleLayer,
  onToggleSource,
}) {
  return (
    <div className="sleek-scrollbar max-h-[min(70vh,520px)] overflow-y-auto">
      <div className="space-y-3 px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Scope</p>
        <div className="flex flex-wrap gap-2">
          {SCOPE_MODES.map(mode => (
            <SegmentButton
              key={mode.id}
              active={draftScope === mode.id}
              onClick={() => onApplyScope(mode.id)}
              disabled={locating}
            >
              {mode.label}
            </SegmentButton>
          ))}
        </div>

        {draftScope === 'national' && (
          <div className="space-y-2">
            <input
              type="search"
              value={countryQuery}
              onChange={e => setCountryQuery(e.target.value)}
              placeholder="Search countries..."
              className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2.5 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-[#444] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {filteredCountries.map(c => (
                <SegmentButton
                  key={c.id}
                  active={draftCountryId === c.id}
                  onClick={() => onApplyCountry(c.id)}
                  className="!min-h-[36px] !flex-none px-3"
                >
                  {c.label}
                </SegmentButton>
              ))}
            </div>
          </div>
        )}

        {draftScope === 'local' && (
          <div className="space-y-2">
            <div className={locating ? 'locating-border-beam w-full' : 'w-full'}>
              <button
                type="button"
                onClick={() => onApplyScope('local')}
                disabled={locating}
                className={
                  locating
                    ? 'locating-border-beam__inner px-3 py-2.5 font-mono text-[11px] text-command-live'
                    : 'w-full rounded border border-[#333] bg-[#141414] px-3 py-2.5 font-mono text-[11px] text-white transition-colors hover:border-[#555] disabled:opacity-60'
                }
              >
                {locating ? 'Locating…' : userLocation ? 'Refresh my location' : 'Use my location'}
              </button>
            </div>
            {userLocation && (
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map(r => (
                  <SegmentButton
                    key={r}
                    active={draftRadius === r}
                    onClick={() => onApplyRadius(r)}
                    className="!min-h-[36px] !flex-none px-3"
                  >
                    {r} mi
                  </SegmentButton>
                ))}
              </div>
            )}
          </div>
        )}

        {locationError && (
          <p className="font-mono text-[10px] text-command-watch">{locationError}</p>
        )}
      </div>

      <FeedStatusBar feeds={feedStatus} />

      <div className="space-y-2 border-t border-panel-border px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">Sources</p>
        <div className="flex flex-wrap gap-2">
          {DATA_SOURCES.map(source => (
            <ToggleChip
              key={source.id}
              active={activeDataSources.has(source.id)}
              onClick={() => onToggleSource(source.id)}
              iconSrc={source.logo}
              iconAlt={source.label}
              accent="live"
            >
              {source.label}
            </ToggleChip>
          ))}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">Layers</p>
        <div className="flex flex-wrap gap-2">
          {RISK_LAYERS.map(layer => (
            <ToggleChip
              key={layer.id}
              active={activeLayers.has(layer.id)}
              onClick={() => onToggleLayer(layer.id)}
              loading={layerLoading[layer.id]}
              layerColor={layer.color}
              showDot
            >
              {layer.shortLabel}
            </ToggleChip>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PublicDataCommandMobileView({
  scope,
  radiusMiles,
  countryId,
  userLocation,
  onScopeApply,
  activeLayers,
  activeDataSources,
  toggleLayer,
  toggleSource,
  layerLoading,
  feedStatus,
  signals,
}) {
  const [draftScope, setDraftScope] = useState(scope)
  const [draftRadius, setDraftRadius] = useState(radiusMiles)
  const [draftCountryId, setDraftCountryId] = useState(countryId)
  const [countryQuery, setCountryQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    setDraftScope(scope)
    setDraftRadius(radiusMiles)
    setDraftCountryId(countryId)
  }, [scope, radiusMiles, countryId])

  useEffect(() => {
    if (!filtersOpen) return
    const onKeyDown = e => {
      if (e.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [filtersOpen])

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.label.toLowerCase().includes(q))
  }, [countryQuery])

  const applyScope = async nextScope => {
    setLocationError('')
    setDraftScope(nextScope)

    if (nextScope === 'global') {
      onScopeApply({
        scope: 'global',
        radiusMiles: draftRadius,
        countryId: draftCountryId,
        userLocation: null,
      })
      return
    }

    if (nextScope === 'national') {
      onScopeApply({
        scope: 'national',
        radiusMiles: draftRadius,
        countryId: draftCountryId,
        userLocation: null,
      })
      return
    }

    if (userLocation) {
      onScopeApply({
        scope: 'local',
        radiusMiles: draftRadius,
        countryId: draftCountryId,
        userLocation,
      })
      return
    }

    setLocating(true)
    try {
      const location = await requestLocation()
      onScopeApply({
        scope: 'local',
        radiusMiles: draftRadius,
        countryId: draftCountryId,
        userLocation: location,
      })
    } catch {
      setLocationError('Unable to access your location. Try National or Global scope.')
    } finally {
      setLocating(false)
    }
  }

  const applyCountry = id => {
    setDraftCountryId(id)
    if (draftScope === 'national') {
      onScopeApply({
        scope: 'national',
        radiusMiles: draftRadius,
        countryId: id,
        userLocation: null,
      })
    }
  }

  const applyRadius = miles => {
    setDraftRadius(miles)
    if (draftScope === 'local' && userLocation) {
      onScopeApply({
        scope: 'local',
        radiusMiles: miles,
        countryId: draftCountryId,
        userLocation,
      })
    }
  }

  const scopeLabel =
    scope === 'local'
      ? userLocation
        ? `Local · ${radiusMiles} mi`
        : 'Local · set location'
      : scope === 'national'
        ? COUNTRIES.find(c => c.id === countryId)?.label ?? countryId
        : 'Global'

  const signalCountLabel = `${signals.length} signal${signals.length === 1 ? '' : 's'}`

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#050505] text-ink-primary">
      <header className="mobile-feed-sticky shrink-0 border-b border-panel-border bg-[#060606]/95 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/"
              aria-label="Back to home"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#2a2a2a] text-ink-muted transition-colors hover:border-[#444] hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M11 4L6 9l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <div className="min-w-0">
              <Link
                to="/"
                className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-white"
              >
                Home
              </Link>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white leading-tight truncate">
                Public Data Command
              </p>
            </div>
          </div>
          <StatusChip label="Live" status="live" pulse />
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{
          paddingBottom: `calc(${PEEK_BAR_HEIGHT} + max(0.5rem, env(safe-area-inset-bottom)))`,
        }}
      >
        <IntelligencePanel variant="feed" compactFeed signals={signals} scope={scope} />
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <motion.button
            type="button"
            aria-label="Close filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setFiltersOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="mobile-feed-dock pointer-events-none fixed inset-x-0 bottom-0 z-50">
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              key="filter-sheet"
              id="mobile-pdc-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Feed filters"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="mobile-feed-sheet pointer-events-auto border-t border-panel-border bg-[#0a0a0a]/98 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Filters</p>
                  <p className="font-display text-sm font-medium text-white">{scopeLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded border border-[#333] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted transition-colors hover:border-[#555] hover:text-white"
                >
                  Done
                </button>
              </div>
              <MobileFilterPanel
                draftScope={draftScope}
                draftRadius={draftRadius}
                draftCountryId={draftCountryId}
                countryQuery={countryQuery}
                setCountryQuery={setCountryQuery}
                filteredCountries={filteredCountries}
                locating={locating}
                locationError={locationError}
                userLocation={userLocation}
                activeLayers={activeLayers}
                activeDataSources={activeDataSources}
                layerLoading={layerLoading}
                feedStatus={feedStatus}
                onApplyScope={applyScope}
                onApplyCountry={applyCountry}
                onApplyRadius={applyRadius}
                onToggleLayer={toggleLayer}
                onToggleSource={toggleSource}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!filtersOpen && (
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
            className="mobile-feed-peek pointer-events-auto w-full border-t border-panel-border bg-[#0a0a0a]/98 backdrop-blur-md"
          >
            <div className="flex justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-[#444]" aria-hidden />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <div className="min-w-0 text-left">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
                  {scopeLabel}
                </p>
                <p className="font-display text-sm text-white">
                  {signalCountLabel}
                  <span className="ml-2 font-mono text-[10px] text-ink-muted">· Tap to filter</span>
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-command-live">
                Filters
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
