import { RISK_LAYERS } from '../../data/commandMapData'

import { TextAction, ToggleChip } from '../ui/CommandControls'



export default function LayerOverlayBar({

  activeLayers,

  onToggleLayer,

  onEnableAll,

  onClearAll,

  layerCounts,

  layerLoading = {},

}) {

  return (

    <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2.5 sm:bottom-4 sm:left-4 sm:right-4">

      <div className="flex items-center justify-between gap-3">

        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/75">Data overlays</p>

        <div className="flex gap-2">

          <TextAction highlight onClick={onEnableAll}>

            All

          </TextAction>

          <TextAction onClick={onClearAll}>Clear</TextAction>

        </div>

      </div>



      <div className="sleek-scrollbar flex gap-2 overflow-x-auto pb-1">

        {RISK_LAYERS.map(layer => {

          const active = activeLayers.has(layer.id)

          const count = layerCounts[layer.id] ?? 0

          const loading = layerLoading[layer.id]

          return (

            <ToggleChip

              key={layer.id}

              active={active}

              layerColor={layer.color}

              loading={loading}

              onClick={() => onToggleLayer(layer.id)}

              title={`${layer.label} · ${layer.sources}`}

            >

              <span className="flex items-center gap-1.5">

                {layer.shortLabel ?? layer.label}

                {!loading && count > 0 && (

                  <span

                    className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${

                      active ? 'bg-white/15 text-white' : 'bg-[#222] text-ink-muted'

                    }`}

                  >

                    {count}

                  </span>

                )}

              </span>

            </ToggleChip>

          )

        })}

      </div>

    </div>

  )

}

