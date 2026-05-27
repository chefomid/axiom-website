import { useEffect, useRef, useState } from 'react'

import { DATA_SOURCES, EARTHQUAKE_MAGNITUDE_OPTIONS, RISK_LAYERS } from '../../data/commandMapData'

import { DockTab, TextAction, ToggleChip } from '../ui/CommandControls'



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

  pinMode = false,

  onTogglePinMode,

  pinCount = 0,

  onClearPins,

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

    <div ref={dockRef} className="absolute bottom-4 left-1/2 z-20 w-[min(100%,34rem)] -translate-x-1/2 px-3">

      {openPanel && (

        <div className="mb-2.5 rounded-xl border border-[#2e2e2e] bg-[#0a0a0a]/98 p-4 shadow-xl backdrop-blur-md">

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

              <div className="flex flex-wrap gap-2">

                {DATA_SOURCES.map(source => (

                  <ToggleChip

                    key={source.id}

                    active={activeDataSources.has(source.id)}

                    accent="stable"

                    onClick={() => onToggleSource(source.id)}

                  >

                    {source.label}

                  </ToggleChip>

                ))}

              </div>

            </>

          )}



          {openPanel === 'pins' && (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Measure pins
                </p>
                {pinCount > 0 && onClearPins && (
                  <TextAction onClick={onClearPins}>Clear pins</TextAction>
                )}
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-ink-faint">
                {pinMode ? (
                  <>
                    Crosshair cursor on the map — click to place a pin (max 10). Click one pin,
                    then another to measure distance. Right-click a pin to remove it. Amber rings
                    are your annotations, not live hazard data.
                  </>
                ) : (
                  <>Enable Pin mode from the dock to place measure pins on the map.</>
                )}
              </p>
              {pinCount > 0 && (
                <p className="mt-2 font-mono text-[10px] tabular-nums text-command-watch">
                  {pinCount} pin{pinCount === 1 ? '' : 's'} placed
                </p>
              )}
            </>
          )}

          {openPanel === 'earthquake' && showEarthquakeControls && (

            <>

              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">

                Earthquake magnitude

              </p>

              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">

                USGS · last 30 days · {earthquakeCount} shown

                {activeMagOption ? ` · ${activeMagOption.description}` : ''}

              </p>

              <div className="mt-3.5 flex flex-wrap gap-2">

                {EARTHQUAKE_MAGNITUDE_OPTIONS.map(opt => (

                  <ToggleChip

                    key={opt.value}

                    active={minEarthquakeMag === opt.value}

                    accent="cyber"

                    loading={layerLoading.earthquake && minEarthquakeMag === opt.value}

                    onClick={() => onMinEarthquakeMagChange(opt.value)}

                  >

                    {opt.label}

                  </ToggleChip>

                ))}

              </div>

              <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">

                Choose <span className="text-command-cyber">All</span> for every event M2.5 and above in your

                scope. Each quake appears as its own point on the map.

              </p>

            </>

          )}

        </div>

      )}



      <div className="cmd-dock-bar flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#2e2e2e] bg-[#0a0a0a]/95 px-2.5 py-2 shadow-lg backdrop-blur-md">

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

        {showEarthquakeControls && (

          <>

            <span className="h-4 w-px bg-[#333]" aria-hidden />

            <DockTab active={openPanel === 'earthquake'} onClick={() => togglePanel('earthquake')}>

              Mag

              <span className="ml-1 tabular-nums text-ink-faint">

                {EARTHQUAKE_MAGNITUDE_OPTIONS.find(o => o.value === minEarthquakeMag)?.label ?? minEarthquakeMag}

              </span>

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

  )

}

