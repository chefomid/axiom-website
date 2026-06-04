import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import useMapPins from '../../hooks/useMapPins'
import { earthquakesToSignals } from '../../services/usgsEarthquakes'
import { nwsToSignals } from '../../services/nwsAlerts'
import { firmsToSignals } from '../../services/nasaFirms'
import { nfhlToSignals } from '../../services/femaNfhl'
import {
  filterMarkers,
  filterMarkersByScope,
  filterZones,
} from '../../utils/filterMapData'
import { getFeedDataRangeLabel } from '../../utils/feedDataRange'
import {
  dataSourceToggleMessage,
  layerToggleMessage,
  scopeAppliedMessage,
  TELEMETRY_SOURCE,
} from '../../utils/userTelemetry'
import CommandHeader from './CommandHeader'
import FeedStatusBar from './FeedStatusBar'
import IntelligencePanel from './IntelligencePanel'
import TelemetryFeed from './TelemetryFeed'
import MapErrorBoundary from './MapErrorBoundary'
import CommandMap from './CommandMap'
import EarthquakeAnalysisModal from './EarthquakeAnalysisModal'

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
  const [searchParams] = useSearchParams()
  const deepLat = parseFloat(searchParams.get('lat') ?? '')
  const deepLng = parseFloat(searchParams.get('lng') ?? '')
  const deepScope = searchParams.get('scope')
  const hasDeepLocation =
    deepScope === 'local' && Number.isFinite(deepLat) && Number.isFinite(deepLng)
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

  const [scope, setScope] = useState(hasDeepLocation ? 'local' : 'global')
  const [radiusMiles, setRadiusMiles] = useState(50)
  const [countryId, setCountryId] = useState('US')
  const [userLocation, setUserLocation] = useState(
    hasDeepLocation ? { lat: deepLat, lng: deepLng } : null,
  )
  const [scopeModalOpen, setScopeModalOpen] = useState(false)
  const [scopeApplyKey, setScopeApplyKey] = useState(0)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [minEarthquakeMag, setMinEarthquakeMag] = useState(2.5)

  useEffect(() => {
    if (!hasDeepLocation) return
    sessionStorage.setItem(SCOPE_STORAGE_KEY, 'true')
    pushEvent({
      text: 'Map centered on your property',
      type: 'live',
      source: TELEMETRY_SOURCE.scope,
    })
  }, [hasDeepLocation, deepLat, deepLng, pushEvent])

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
    movePin,
    clearPins,
  } = useMapPins({ pushEvent })

  const [analysisPinCenter, setAnalysisPinCenter] = useState(null)

  const usgsEnabled = activeDataSources.has('usgs') && activeLayers.has('earthquake')
  const {
    markers: usgsMarkers,
    loading: usgsLoading,
    error: usgsError,
    errorRetryAt: usgsErrorRetryAt,
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
    errorRetryAt: nwsErrorRetryAt,
    meta: nwsMeta,
  } = useNwsAlerts({ ...scopeConfig, enabled: nwsEnabled })

  const firmsEnabled = activeDataSources.has('nasa') && activeLayers.has('wildfire')
  const {
    markers: firmsMarkers,
    loading: firmsLoading,
    error: firmsError,
    errorRetryAt: firmsErrorRetryAt,
    meta: firmsMeta,
  } = useNasaFirms({ ...scopeConfig, enabled: firmsEnabled })

  const femaEnabled = activeDataSources.has('fema') && activeLayers.has('flood')
  const {
    zones: nfhlZones,
    loading: femaLoading,
    error: femaError,
    errorRetryAt: femaErrorRetryAt,
    meta: femaMeta,
  } = useFemaNfhl({ ...scopeConfig, enabled: femaEnabled })

  const allPointMarkers = useMemo(
    () => [...usgsMarkers, ...firmsMarkers],
    [usgsMarkers, firmsMarkers],
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

    return [...usgsSignals, ...nwsSignals, ...firmsSignals, ...nfhlSignals]
      .filter(s => allIds.includes(s.markerId))
      .slice(0, 12)
  }, [visibleMarkers, visibleZones, usgsEnabled, nwsEnabled, firmsEnabled, femaEnabled])

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
          text: layerToggleMessage(label, enabling),
          type: enabling ? 'live' : 'stable',
          source: TELEMETRY_SOURCE.layers,
        })
        return next
      })
    },
    [pushEvent],
  )

  const enableAllLayers = useCallback(() => {
    setActiveLayers(new Set(RISK_LAYERS.map(l => l.id)))
    pushEvent({ text: 'All layers turned on', type: 'live', source: TELEMETRY_SOURCE.layers })
  }, [pushEvent])

  const clearAllLayers = useCallback(() => {
    setActiveLayers(new Set())
    pushEvent({ text: 'All layers turned off', type: 'watch', source: TELEMETRY_SOURCE.layers })
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
          text: dataSourceToggleMessage(label, enabling),
          type: enabling ? 'live' : 'stable',
          source: TELEMETRY_SOURCE.layers,
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
        pushEvent({ text: 'Selection cleared', type: 'stable', source: TELEMETRY_SOURCE.map })
        return
      }
      const item =
        allPointMarkers.find(m => m.id === id) ?? allZones.find(z => z.id === id)
      pushEvent({
        text: `Selected — ${item?.title ?? 'map item'}`,
        type: 'live',
        source: TELEMETRY_SOURCE.map,
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
      setScopeApplyKey(k => k + 1)
      sessionStorage.setItem(SCOPE_STORAGE_KEY, 'true')

      const country = COUNTRIES.find(c => c.id === nextCountry)
      pushEvent({
        text: scopeAppliedMessage(nextScope, {
          radiusMiles: nextRadius,
          countryLabel: country?.label,
        }),
        type: 'live',
        source: TELEMETRY_SOURCE.scope,
      })
    },
    [pushEvent],
  )

  const handleScopeChange = useCallback(
    partial => {
      if (partial.scope !== undefined) {
        setScope(partial.scope)
        const scopeText = {
          local: 'Switched to nearby view',
          national: 'Switched to country view',
          global: 'Switched to worldwide view',
        }[partial.scope]
        if (scopeText) {
          pushEvent({
            text: scopeText,
            type: 'live',
            source: TELEMETRY_SOURCE.scope,
          })
        }
      }
      if (partial.radiusMiles !== undefined) {
        setRadiusMiles(partial.radiusMiles)
        pushEvent({
          text: `Search radius set to ${partial.radiusMiles} miles`,
          type: 'stable',
          source: TELEMETRY_SOURCE.scope,
        })
      }
      if (partial.countryId !== undefined) {
        setCountryId(partial.countryId)
        const country = COUNTRIES.find(c => c.id === partial.countryId)
        pushEvent({
          text: `Showing ${country?.label ?? 'selected country'}`,
          type: 'stable',
          source: TELEMETRY_SOURCE.scope,
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
        text: `Showing earthquakes ${label} (last 30 days)`,
        type: 'live',
        source: TELEMETRY_SOURCE.earthquake,
      })
    },
    [pushEvent],
  )

  const handleOpenAnalysis = useCallback(() => {
    setAnalysisPinCenter(null)
    setAnalysisOpen(true)
    pushEvent({
      text: 'Opened earthquake analysis',
      type: 'live',
      source: TELEMETRY_SOURCE.earthquake,
    })
  }, [pushEvent])

  const handleAnalyzeAtPin = useCallback(
    pin => {
      if (!pin) return
      setAnalysisPinCenter({
        lat: pin.lat,
        lng: pin.lng,
        label: pin.label ?? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
      })
      setAnalysisOpen(true)
      pushEvent({
        text: `Earthquake analysis at ${pin.label ?? 'pin'}`,
        type: 'live',
        source: TELEMETRY_SOURCE.earthquake,
      })
    },
    [pushEvent],
  )

  const handleCloseAnalysis = useCallback(() => {
    setAnalysisOpen(false)
    setAnalysisPinCenter(null)
  }, [])

  const layerLoading = useMemo(
    () => ({
      earthquake: usgsLoading,
      weather: nwsLoading,
      wildfire: firmsLoading,
      flood: femaLoading,
    }),
    [usgsLoading, nwsLoading, firmsLoading, femaLoading],
  )

  const liveFeedErrors = useMemo(() => {
    const errors = []
    if (usgsError) {
      errors.push({
        source: 'USGS',
        message: usgsError,
        retryAt: usgsErrorRetryAt,
        stale: usgsMeta.stale,
        lastFetchedAt: usgsMeta.lastFetchedAt,
      })
    }
    if (nwsError) {
      errors.push({
        source: 'NWS',
        message: nwsError,
        retryAt: nwsErrorRetryAt,
        stale: nwsMeta.stale,
        lastFetchedAt: nwsMeta.lastFetchedAt,
      })
    }
    if (firmsError) {
      errors.push({
        source: 'NASA FIRMS',
        message: firmsError,
        retryAt: firmsErrorRetryAt,
        stale: firmsMeta.stale,
        lastFetchedAt: firmsMeta.lastFetchedAt,
      })
    }
    if (femaError) {
      errors.push({
        source: 'FEMA NFHL',
        message: femaError,
        retryAt: femaErrorRetryAt,
        stale: femaMeta.stale,
        lastFetchedAt: femaMeta.lastFetchedAt,
      })
    }
    return errors
  }, [
    usgsError,
    usgsErrorRetryAt,
    usgsMeta.stale,
    usgsMeta.lastFetchedAt,
    nwsError,
    nwsErrorRetryAt,
    nwsMeta.stale,
    nwsMeta.lastFetchedAt,
    firmsError,
    firmsErrorRetryAt,
    firmsMeta.stale,
    firmsMeta.lastFetchedAt,
    femaError,
    femaErrorRetryAt,
    femaMeta.stale,
    femaMeta.lastFetchedAt,
  ])

  const feedStatus = useMemo(
    () => [
      {
        sourceName: 'USGS',
        enabled: activeDataSources.has('usgs'),
        loading: usgsLoading,
        error: usgsError,
        stale: usgsMeta.stale,
        recordCount: usgsMeta.recordCount,
        lastFetchedAt: usgsMeta.lastFetchedAt,
        requestUrl: usgsMeta.requestUrl,
        dataRange: getFeedDataRangeLabel('USGS', { minMagnitude: minEarthquakeMag }),
      },
      {
        sourceName: 'NWS',
        enabled: activeDataSources.has('nws'),
        loading: nwsLoading,
        error: nwsError,
        stale: nwsMeta.stale,
        recordCount: nwsMeta.recordCount,
        lastFetchedAt: nwsMeta.lastFetchedAt,
        requestUrl: nwsMeta.requestUrl,
        dataRange: getFeedDataRangeLabel('NWS'),
      },
      {
        sourceName: 'NASA FIRMS',
        enabled: activeDataSources.has('nasa'),
        loading: firmsLoading,
        error: firmsError,
        stale: firmsMeta.stale,
        recordCount: firmsMeta.recordCount,
        lastFetchedAt: firmsMeta.lastFetchedAt,
        requestUrl: firmsMeta.requestUrl,
        dataRange: getFeedDataRangeLabel('NASA FIRMS'),
      },
      {
        sourceName: 'FEMA NFHL',
        enabled: activeDataSources.has('fema'),
        loading: femaLoading,
        error: femaError,
        stale: femaMeta.stale,
        recordCount: femaMeta.recordCount,
        lastFetchedAt: femaMeta.lastFetchedAt,
        requestUrl: femaMeta.requestUrl,
        dataRange: getFeedDataRangeLabel('FEMA NFHL'),
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
      minEarthquakeMag,
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
                scopeApplyKey={scopeApplyKey}
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
                analysisOpen={analysisOpen}
                onOpenAnalysis={handleOpenAnalysis}
                zoneCount={visibleZones.length}
                pinMode={pinMode}
                pins={pins}
                segments={segments}
                selectedPinId={selectedUserPinId}
                onAddPin={addPin}
                onSelectPin={selectPin}
                onRemovePin={removePin}
                onMovePin={movePin}
                onAnalyzeAtPin={handleAnalyzeAtPin}
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

      <EarthquakeAnalysisModal
        open={analysisOpen && usgsEnabled}
        onClose={handleCloseAnalysis}
        scope={scope}
        userLocation={userLocation}
        countryId={countryId}
        initialMinMagnitude={minEarthquakeMag}
        initialCenterOverride={analysisPinCenter}
      />
    </div>
  )
}
