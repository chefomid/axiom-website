import { useEffect, useRef, useState } from 'react'
import { DATA_SOURCES, EARTHQUAKE_MAGNITUDE_OPTIONS, RISK_LAYERS } from '../../data/commandMapData'
import { DockTab, SourceToggle, TextAction, ToggleChip } from '../ui/CommandControls'

export default function MapControlsDock({
  activeLayers,
  onToggleLayer,
  onEnableAllLayers,
  onClearAllLayers,
  activeDataSources,
  onToggleSource,
  layerCounts,
  layerLoading = {},
  visibleCount,
  zoneCount = 0,
  minEarthquakeMag,
  onMinEarthquakeMagChange,
  earthquakeCount = 0,
  usgsEnabled,
  analysisOpen = false,
  onOpenAnalysis,
  pinMode = false,
  onTogglePinMode,
  pinCount = 0,
  onClearPins,
  onMakeSquare,
  onAnalyzeAtPin,
  pins = [],
  selectedPinId = null,
  scanlineOn = true,
  onToggleScanline,
}) {
  const [openPanel, setOpenPanel] = useState(null)
  const dockRef = useRef(null)

  const earthquakeLayerOn = activeLayers.has('earthquake')
  const showEarthquakeControls = usgsEnabled && earthquakeLayerOn

  useEffect(() => {
    if (!openPanel) return undefined
    const close = e => {
      if (dockRef.current && !dockRef.current.contains(e.target)) setOpenPanel(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openPanel])

  useEffect(() => {
    if (openPanel === 'earthquake' && !showEarthquakeControls) setOpenPanel(null)
  }, [openPanel, showEarthquakeControls])

  const togglePanel = id => setOpenPanel(prev => (prev === id ? null : id))

  const activeLayerList = RISK_LAYERS.filter(l => activeLayers.has(l.id))
  const activeMagOption = EARTHQUAKE_MAGNITUDE_OPTIONS.find(o => o.value === minEarthquakeMag)

  return (
    <div ref={dockRef} className="absolute bottom-4 left-1/2 z-20 w-[min(100%,38rem)] -translate-x-1/2 px-3">
      <div className="cmd-dock-bar overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#0a0a0a] shadow-lg">
        {openPanel && (
          <div className="relative px-4 py-4 pr-10">
            <button
              type="button"
              onClick={() => setOpenPanel(null)}
              aria-label="Close panel"
              className="absolute right-3 top-3 rounded-md border border-[#333] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition hover:border-[#555] hover:text-white"
            >
              Close
            </button>

            {openPanel === 'layers' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Layers</p>
                  <div className="flex gap-2">
                    <TextAction highlight onClick={onEnableAllLayers}>
                      All
                    </TextAction>
                    <TextAction onClick={onClearAllLayers}>Clear</TextAction>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RISK_LAYERS.map(layer => {
                    const active = activeLayers.has(layer.id)
                    const count = layerCounts[layer.id] ?? 0
                    return (
                      <ToggleChip
                        key={layer.id}
                        active={active}
                        layerColor={layer.color}
                        loading={layerLoading[layer.id]}
                        onClick={() => onToggleLayer(layer.id)}
                      >
                        {layer.shortLabel ?? layer.label}
                        {!layerLoading[layer.id] && count > 0 ? ` · ${count}` : ''}
                      </ToggleChip>
                    )
                  })}
                </div>
              </>
            )}

            {openPanel === 'sources' && (
              <>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Data sources</p>
                <div className="grid grid-cols-2 gap-2">
                  {DATA_SOURCES.map(source => (
                    <SourceToggle
                      key={source.id}
                      source={source}
                      active={activeDataSources.has(source.id)}
                      onClick={() => onToggleSource(source.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {openPanel === 'pins' && (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Measure pins</p>
                  {pinCount > 0 && onClearPins && (
                    <TextAction onClick={onClearPins}>Clear pins</TextAction>
                  )}
                </div>
                <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
                  {pinMode ? (
                    <>
                      Click the map to place pins, every 4 pins close a region, then the chain breaks.
                      Right-click empty map to break early. Right-click a pin or shaded region to remove.
                      Hover a region to analyze.
                    </>
                  ) : (
                    <>Turn on Pin to measure on the map.</>
                  )}
                </p>
                {pinCount > 0 && (
                  <>
                    <p className="mt-2 font-mono text-[10px] tabular-nums text-command-watch">
                      {pinCount} pin{pinCount === 1 ? '' : 's'} placed
                    </p>
                    {pinCount >= 4 && onMakeSquare && (
                      <button
                        type="button"
                        onClick={onMakeSquare}
                        className="mt-3 w-full rounded-lg border border-command-live/40 bg-command-live/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-command-live transition hover:border-command-live/60 hover:bg-command-live/15"
                      >
                        Make square
                      </button>
                    )}
                    {onAnalyzeAtPin && usgsEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          const pin = pins.find(p => p.id === selectedPinId) ?? pins[pins.length - 1]
                          if (pin) onAnalyzeAtPin(pin)
                        }}
                        className="mt-3 w-full rounded-lg border border-command-watch/40 bg-command-watch/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-command-watch transition hover:border-command-watch/60 hover:bg-command-watch/15"
                      >
                        Analyze at {selectedPinId ? 'selected pin' : 'latest pin'}
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {openPanel === 'earthquake' && showEarthquakeControls && (
              <>
                <p className="section-label-sm">Minimum magnitude</p>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">
                  USGS · last 30 days · {earthquakeCount} shown
                  {activeMagOption ? ` · ${activeMagOption.description}` : ''}
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {EARTHQUAKE_MAGNITUDE_OPTIONS.map(opt => (
                    <ToggleChip
                      key={opt.value}
                      active={minEarthquakeMag === opt.value}
                      layerColor={opt.color}
                      labelClassName={opt.labelClassName}
                      loading={layerLoading.earthquake && minEarthquakeMag === opt.value}
                      title={opt.description}
                      onClick={() => onMinEarthquakeMagChange(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
                  <span className="text-command-cyber">All</span> is the full M2.5+ catalog; M3+ and higher
                  only remove smaller events. Each quake appears as its own point on the map.
                </p>
              </>
            )}
          </div>
        )}

        <div
          className={`flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-2${
            openPanel ? ' border-t border-[#252525]/60' : ''
          }`}
        >
          <DockTab active={openPanel === 'layers'} onClick={() => togglePanel('layers')}>
            Layers
            {activeLayerList.length > 0 && (
              <span className="ml-1 tabular-nums text-ink-faint">({activeLayerList.length})</span>
            )}
          </DockTab>

          <span className="h-4 w-px bg-[#333]" aria-hidden />

          <DockTab active={openPanel === 'sources'} onClick={() => togglePanel('sources')}>
            Sources
          </DockTab>

          <span className="h-4 w-px bg-[#333]" aria-hidden />

          <DockTab
            active={pinMode}
            accent="live"
            onClick={() => {
              if (!pinMode) setOpenPanel('pins')
              else if (openPanel === 'pins') setOpenPanel(null)
              onTogglePinMode?.()
            }}
          >
            Pin
            {pinCount > 0 && (
              <span className="ml-1 tabular-nums text-ink-faint">({pinCount})</span>
            )}
          </DockTab>

          <span className="h-4 w-px bg-[#333]" aria-hidden />

          <DockTab
            active={scanlineOn}
            accent="live"
            title={scanlineOn ? 'Hide green scan bar' : 'Show green scan bar'}
            aria-pressed={scanlineOn}
            onClick={() => onToggleScanline?.()}
          >
            Scan
          </DockTab>

          {showEarthquakeControls && (
            <>
              <span className="h-4 w-px bg-[#333]" aria-hidden />
              <DockTab active={openPanel === 'earthquake'} onClick={() => togglePanel('earthquake')}>
                Mag
                <span className="ml-1 tabular-nums text-ink-faint">
                  {EARTHQUAKE_MAGNITUDE_OPTIONS.find(o => o.value === minEarthquakeMag)?.label ??
                    minEarthquakeMag}
                </span>
              </DockTab>
              <span className="h-4 w-px bg-[#333]" aria-hidden />
              <DockTab active={analysisOpen} accent="watch" onClick={() => onOpenAnalysis?.()}>
                Seismic/EQ
              </DockTab>
            </>
          )}

          <span className="h-4 w-px bg-[#333]" aria-hidden />

          <span className="px-2 py-1 font-mono text-[10px] tabular-nums text-ink-faint">
            {visibleCount} pts
            {zoneCount > 0 ? ` · ${zoneCount} zones` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
