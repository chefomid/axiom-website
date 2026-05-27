import { RISK_LAYERS } from '../../data/commandMapData'

import DataSourcePanel from './DataSourcePanel'

import { PanelToggle } from '../ui/CommandControls'



export default function RiskLayerPanel({ activeLayers, onToggleLayer, activeDataSources, onToggleSource }) {

  return (

    <aside className="flex h-full min-h-0 flex-col border-r border-panel-border bg-panel-bg/95 backdrop-blur-sm">

      <div className="shrink-0 border-b border-panel-border px-4 py-3.5">

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Public Data Layers</p>

        <p className="font-display mt-1 text-sm font-medium text-white">Open Feeds</p>

      </div>

      <div className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">

        <ul className="space-y-1">

          {RISK_LAYERS.map(layer => {

            const active = activeLayers.has(layer.id)

            return (

              <li key={layer.id}>

                <PanelToggle

                  active={active}

                  accent="live"

                  label={layer.label}

                  meta={layer.sources}

                  onClick={() => onToggleLayer(layer.id)}

                />

              </li>

            )

          })}

        </ul>

      </div>

      <DataSourcePanel activeDataSources={activeDataSources} onToggle={onToggleSource} />

    </aside>

  )

}

