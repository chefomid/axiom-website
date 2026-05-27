import { useCallback, useEffect, useMemo, useState } from 'react'
import { TelemetryProvider, useTelemetry } from '../../context/TelemetryContext'
import {
  COUNTRIES,
  DATA_SOURCES,
  EARTHQUAKE_MAGNITUDE_OPTIONS,
  RISK_LAYERS,
} from '../../data/commandMapData'
import useUsgsEarthquakes from '../../hooks/useUsgsEarthquakes'
import useNwsAlerts from '../../hooks/useNwsAlerts'
import useNasaFirms from '../../hooks/useNasaFirms'
import useFemaNfhl from '../../hooks/useFemaNfhl'
import useAirNow from '../../hooks/useAirNow'
import useMapPins from '../../hooks/useMapPins'
import { earthquakesToSignals } from '../../services/usgsEarthquakes'
import { nwsToSignals } from '../../services/nwsAlerts'
import { firmsToSignals } from '../../services/nasaFirms'
import { nfhlToSignals } from '../../services/femaNfhl'
import { airNowToSignals } from '../../services/airNow'
import {
  filterMarkers,
  filterMarkersByScope,
  filterZones,
} from '../../utils/filterMapData'
import CommandHeader from './CommandHeader'
import FeedStatusBar from './FeedStatusBar'
import IntelligencePanel from './IntelligencePanel'
import TelemetryFeed from './TelemetryFeed'
import MapErrorBoundary from './MapErrorBoundary'
import CommandMap from './CommandMap'

const SCOPE_STORAGE_KEY = 'axiom-command-scope-configured'

export default function PublicDataCommandView() {
  return (
    <TelemetryProvider>
      <PublicDataCommandViewInner />
    </TelemetryProvider>
  )
}

function PublicDataCommandViewInner() {
  const { pushEvent } = useTelemetry()
  const defaultLayers = useMemo(
    () => new Set(RISK_LAYERS.filter(l => l.defaultActive).map(l => l.id)),
    [],
  )
  const defaultSources = useMemo(
    () => new Set(DATA_SOURCES.filter(s => s.defaultActive).map(s => s.id)),
    [],
  )

  const [activeLayers, setActiveLayers] = useState(defaultLayers)
  const [activeDataSources, setActiveDataSources] = useState(defaultSources)
  const [selectedMarkerId, setSelectedMarkerId] = useState(null)

  const [scope, setScope] = useState('national')
  const [radiusMiles, setRadiusMiles] = useState(50)
  const [countryId, setCountryId] = useState('US')
  const [userLocation, setUserLocation] = useState(null)
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [minEarthquakeMag, setMinEarthquakeMag] = useState(2.5)

  const scopeConfig = { scope, userLocation, radiusMiles, countryId }

  const {
    pinMode,
    pins,
    segments,
    selectedPinId: selectedUserPinId,
    pinCount,
    togglePinMode,
    addPin,
    selectPin,
    removePin,
    clearPins,
  } = useMapPins({ pushEvent })

  const usgsEnabled = activeDataSources.has('usgs') && activeLayers.has('earthquake')
  const {
    markers: usgsMarkers,
    loading: usgsLoading,
    error: usgsError,
    meta: usgsMeta,
  } = useUsgsEarthquakes({
    ...scopeConfig,
    minMagnitude: minEarthquakeMag,
    enabled: usgsEnabled,
  })

  const nwsEnabled = activeDataSources.has('nws') && activeLayers.has('weather')
  const {
    zones: nwsZones,
    loading: nwsLoading,
    error: nwsError,
    meta: nwsMeta,
  } = useNwsAlerts({ ...scopeConfig, enabled: nwsEnabled })

  const firmsEnabled = activeDataSources.has('nasa') && activeLayers.has('wildfire')
  const {
    markers: firmsMarkers,
    loading: firmsLoading,
    error: firmsError,
    meta: firmsMeta,
  } = useNasaFirms({ ...scopeConfig, enabled: firmsEnabled })

  const femaEnabled = activeDataSources.has('fema') && activeLayers.has('flood')
  const {
    zones: nfhlZones,
    loading: femaLoading,
    error: femaError,
    meta: femaMeta,
  } = useFemaNfhl({ ...scopeConfig, enabled: femaEnabled })

  const airNowEnabled = activeDataSources.has('epa') && activeLayers.has('environment')
  const {
    markers: airNowMarkers,
    loading: airNowLoading,
    error: airNowError,
    meta: airNowMeta,
  } = useAirNow({ ...scopeConfig, enabled: airNowEnabled })

  const allPointMarkers = useMemo(
    () => [...usgsMarkers, ...firmsMarkers, ...airNowMarkers],
    [usgsMarkers, firmsMarkers, airNowMarkers],
  )

  const allZones = useMemo(() => [...nwsZones, ...nfhlZones], [nwsZones, nfhlZones])

  const scopedPointMarkers = useMemo(
    () => filterMarkersByScope(allPointMarkers, scopeConfig),
    [allPointMarkers, scope, userLocation, radiusMiles, countryId],
  )

  const visibleMarkers = useMemo(
    () =>
      filterMarkers(allPointMarkers, {
        activeLayers,
        activeDataSources,
        ...scopeConfig,
      }),
    [allPointMarkers, activeLayers, activeDataSources, scope, userLocation, radiusMiles, countryId],
  )

  const visibleZones = useMemo(
    () =>
      filterZones(allZones, {
        activeLayers,
        activeDataSources,
        scope,
        countryId,
      }),
    [allZones, activeLayers, activeDataSources, scope, countryId],
  )

  const layerCounts = useMemo(() => {
    const counts = {}
    for (const layer of RISK_LAYERS) {
      const points = visibleMarkers.filter(m => m.layer === layer.id).length
      const zones = visibleZones.filter(z => z.layer === layer.id).length
      counts[layer.id] = points + zones
    }
    return counts
  }, [visibleMarkers, visibleZones])

  const visibleSignals = useMemo(() => {
    const pointIds = new Set(visibleMarkers.map(m => m.id))
    const zoneIds = new Set(visibleZones.map(z => z.id))
    const allIds = [...pointIds, ...zoneIds]

    const usgsSignals = usgsEnabled
      ? earthquakesToSignals(visibleMarkers.filter(m => m.layer === 'earthquake'))
      : []

    const nwsSignals = nwsEnabled ? nwsToSignals(visibleZones.filter(z => z.layer === 'weather')) : []

    const firmsSignals = firmsEnabled
      ? firmsToSignals(visibleMarkers.filter(m => m.layer === 'wildfire'))
      : []

    const nfhlSignals = femaEnabled
      ? nfhlToSignals(visibleZones.filter(z => z.layer === 'flood'))
      : []

    const airSignals = airNowEnabled
      ? airNowToSignals(visibleMarkers.filter(m => m.layer === 'environment'))
      : []

    return [...usgsSignals, ...nwsSignals, ...firmsSignals, ...nfhlSignals, ...airSignals]
      .filter(s => allIds.includes(s.markerId))
      .slice(0, 12)
  }, [
    visibleMarkers,
    visibleZones,
    usgsEnabled,
    nwsEnabled,
    firmsEnabled,
    femaEnabled,
    airNowEnabled,
  ])

  const nfhlRaster = useMemo(() => {
    if (!femaEnabled || !femaMeta.rasterUrl || !femaMeta.bbox) return null
    return { url: femaMeta.rasterUrl, bbox: femaMeta.bbox }
  }, [femaEnabled, femaMeta.rasterUrl, femaMeta.bbox])

  useEffect(() => {
    const allIds = new Set([...visibleMarkers.map(m => m.id), ...visibleZones.map(z => z.id)])
    if (selectedMarkerId && !allIds.has(selectedMarkerId)) {
      setSelectedMarkerId(null)
    }
  }, [visibleMarkers, visibleZones, selectedMarkerId])

  const toggleLayer = useCallback(
    layerId => {
      const label = RISK_LAYERS.find(l => l.id === layerId)?.shortLabel ?? layerId
      setActiveLayers(prev => {
        const enabling = !prev.has(layerId)
        const next = new Set(prev)
        if (enabling) next.add(layerId)
        else next.delete(layerId)
        pushEvent({
          text: enabling ? `${label} layer enabled` : `${label} layer disabled`,
          type: enabling ? 'live' : 'stable',
          source: 'Layers',
        })
        return next
      })
    },
    [pushEvent],
  )

  const enableAllLayers = useCallback(() => {
    setActiveLayers(new Set(RISK_LAYERS.map(l => l.id)))
    pushEvent({ text: 'All data layers enabled', type: 'live', source: 'Layers' })
  }, [pushEvent])

  const clearAllLayers = useCallback(() => {
    setActiveLayers(new Set())
    pushEvent({ text: 'All data layers cleared', type: 'watch', source: 'Layers' })
  }, [pushEvent])

  const toggleSource = useCallback(
    sourceId => {
      const label = DATA_SOURCES.find(s => s.id === sourceId)?.label ?? sourceId
      setActiveDataSources(prev => {
        const enabling = !prev.has(sourceId)
        const next = new Set(prev)
        if (enabling) next.add(sourceId)
        else next.delete(sourceId)
        pushEvent({
          text: enabling ? `${label} data source enabled` : `${label} data source disabled`,
          type: enabling ? 'live' : 'stable',
          source: 'Sources',
        })
        return next
      })
    },
    [pushEvent],
  )

  const handleSelectMarker = useCallback(
    id => {
      setSelectedMarkerId(id)
      if (!id) {
        pushEvent({ text: 'Selection cleared', type: 'stable', source: 'Map' })
        return
      }
      const item =
        allPointMarkers.find(m => m.id === id) ?? allZones.find(z => z.id === id)
      pushEvent({
        text: `Selected — ${item?.title ?? id}`,
        type: 'live',
        source: 'Map',
      })
    },
    [pushEvent, allPointMarkers, allZones],
  )

  const handleScopeApply = useCallback(
    ({ scope: nextScope, radiusMiles: nextRadius, countryId: nextCountry, userLocation: nextLocation }) => {
      setScope(nextScope)
      setRadiusMiles(nextRadius)
      setCountryId(nextCountry)
      setUserLocation(nextLocation)
      sessionStorage.setItem(SCOPE_STORAGE_KEY, 'true')

      const scopeLabels = { local: 'Local', national: 'National', global: 'Global' }
      pushEvent({
        text: `Operational scope applied — ${scopeLabels[nextScope] ?? nextScope}`,
        type: 'live',
        source: 'Scope',
      })
    },
    [pushEvent],
  )

  const handleScopeChange = useCallback(
    partial => {
      if (partial.scope !== undefined) {
        setScope(partial.scope)
        pushEvent({
          text: `Scope mode — ${partial.scope}`,
          type: 'live',
          source: 'Scope',
        })
      }
      if (partial.radiusMiles !== undefined) {
        setRadiusMiles(partial.radiusMiles)
        pushEvent({
          text: `Local radius set to ${partial.radiusMiles} mi`,
          type: 'stable',
          source: 'Scope',
        })
      }
      if (partial.countryId !== undefined) {
        setCountryId(partial.countryId)
        const country = COUNTRIES.find(c => c.id === partial.countryId)
        pushEvent({
          text: `National scope — ${country?.label ?? partial.countryId}`,
          type: 'stable',
          source: 'Scope',
        })
      }
    },
    [pushEvent],
  )

  const handleMinEarthquakeMagChange = useCallback(
    value => {
      setMinEarthquakeMag(value)
      const label = EARTHQUAKE_MAGNITUDE_OPTIONS.find(o => o.value === value)?.label ?? `M${value}+`
      pushEvent({
        text: `Earthquake filter set to ${label} (last 30 days)`,
        type: 'live',
        source: 'USGS',
      })
    },
    [pushEvent],
  )

  const layerLoading = useMemo(
    () => ({
      earthquake: usgsLoading,
      weather: nwsLoading,
      wildfire: firmsLoading,
      flood: femaLoading,
      environment: airNowLoading,
    }),
    [usgsLoading, nwsLoading, firmsLoading, femaLoading, airNowLoading],
  )

  const liveFeedErrors = useMemo(() => {
    const errors = []
    if (usgsError) errors.push({ source: 'USGS', message: usgsError })
    if (nwsError) errors.push({ source: 'NWS', message: nwsError })
    if (firmsError) errors.push({ source: 'NASA FIRMS', message: firmsError })
    if (femaError) errors.push({ source: 'FEMA NFHL', message: femaError })
    if (airNowError) errors.push({ source: 'AirNow', message: airNowError })
    return errors
  }, [usgsError, nwsError, firmsError, femaError, airNowError])

  const feedStatus = useMemo(
    () => [
      {
        sourceName: 'USGS',
        enabled: activeDataSources.has('usgs'),
        loading: usgsLoading,
        error: usgsError,
        recordCount: usgsMeta.recordCount,
        lastFetchedAt: usgsMeta.lastFetchedAt,
        requestUrl: usgsMeta.requestUrl,
      },
      {
        sourceName: 'NWS',
        enabled: activeDataSources.has('nws'),
        loading: nwsLoading,
        error: nwsError,
        recordCount: nwsMeta.recordCount,
        lastFetchedAt: nwsMeta.lastFetchedAt,
        requestUrl: nwsMeta.requestUrl,
      },
      {
        sourceName: 'NASA FIRMS',
        enabled: activeDataSources.has('nasa'),
        loading: firmsLoading,
        error: firmsError,
        recordCount: firmsMeta.recordCount,
        lastFetchedAt: firmsMeta.lastFetchedAt,
        requestUrl: firmsMeta.requestUrl,
      },
      {
        sourceName: 'FEMA NFHL',
        enabled: activeDataSources.has('fema'),
        loading: femaLoading,
        error: femaError,
        recordCount: femaMeta.recordCount,
        lastFetchedAt: femaMeta.lastFetchedAt,
        requestUrl: femaMeta.requestUrl,
      },
      {
        sourceName: 'AirNow',
        enabled: activeDataSources.has('epa'),
        loading: airNowLoading,
        error: airNowError,
        recordCount: airNowMeta.recordCount,
        lastFetchedAt: airNowMeta.lastFetchedAt,
        requestUrl: airNowMeta.requestUrl,
      },
    ],
    [
      activeDataSources,
      usgsLoading,
      usgsError,
      usgsMeta,
      nwsLoading,
      nwsError,
      nwsMeta,
      firmsLoading,
      firmsError,
      firmsMeta,
      femaLoading,
      femaError,
      femaMeta,
      airNowLoading,
      airNowError,
      airNowMeta,
    ],
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050505] text-ink-primary">
      <CommandHeader />
      <FeedStatusBar feeds={feedStatus} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        <div className="relative min-h-[45vh] min-w-0 flex-1 lg:min-h-0">
          <MapErrorBoundary>
            <CommandMap
              className="h-full w-full"
                markers={visibleMarkers}
                zones={visibleZones}
                nfhlRaster={nfhlRaster}
                scope={scope}
                radiusMiles={radiusMiles}
                countryId={countryId}
                userLocation={userLocation}
                selectedMarkerId={selectedMarkerId}
                onSelectMarker={handleSelectMarker}
                onScopeApply={handleScopeApply}
                onScopeChange={handleScopeChange}
                scopeModalOpen={scopeModalOpen}
                onOpenScopeModal={() => setScopeModalOpen(true)}
                onCloseScopeModal={() => setScopeModalOpen(false)}
                activeLayers={activeLayers}
                onToggleLayer={toggleLayer}
                onToggleSource={toggleSource}
                onEnableAllLayers={enableAllLayers}
                onClearAllLayers={clearAllLayers}
                activeDataSources={activeDataSources}
                layerCounts={layerCounts}
                layerLoading={layerLoading}
                liveFeedErrors={liveFeedErrors}
                minEarthquakeMag={minEarthquakeMag}
                onMinEarthquakeMagChange={handleMinEarthquakeMagChange}
                earthquakeCount={
                  usgsEnabled
                    ? (usgsMeta.recordCount ??
                      visibleMarkers.filter(m => m.layer === 'earthquake').length)
                    : 0
                }
                usgsEnabled={usgsEnabled}
                zoneCount={visibleZones.length}
                pinMode={pinMode}
                pins={pins}
                segments={segments}
                selectedPinId={selectedUserPinId}
                onAddPin={addPin}
                onSelectPin={selectPin}
                onRemovePin={removePin}
                onTogglePinMode={togglePinMode}
                onClearPins={clearPins}
                pinCount={pinCount}
              />
          </MapErrorBoundary>
        </div>

        <div className="hidden h-full w-[300px] shrink-0 overflow-hidden lg:block">
          <IntelligencePanel
            signals={visibleSignals}
            selectedMarkerId={selectedMarkerId}
            onSelectSignal={handleSelectMarker}
            scope={scope}
          />
        </div>
      </div>

      <div className="border-t border-panel-border lg:hidden">
        <details className="group">
          <summary className="cursor-pointer px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Intelligence Panel
          </summary>
          <div className="max-h-64 overflow-y-auto">
            <IntelligencePanel
              signals={visibleSignals}
              selectedMarkerId={selectedMarkerId}
              onSelectSignal={handleSelectMarker}
              scope={scope}
            />
          </div>
        </details>
      </div>

      <TelemetryFeed />
    </div>
  )
}
