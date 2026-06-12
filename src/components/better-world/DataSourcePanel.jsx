import { DATA_SOURCES } from '../../data/commandMapData'

import { SourceToggle } from '../ui/CommandControls'



export default function DataSourcePanel({ activeDataSources, onToggle }) {

  return (

    <div className="border-t border-panel-border">

      <div className="px-4 py-3.5">

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Data Sources</p>

        <p className="font-display mt-1 text-sm font-medium text-white">Government feeds</p>

      </div>

      <div className="sleek-scrollbar max-h-48 overflow-y-auto px-3 pb-3 lg:max-h-none">

        <ul className="grid grid-cols-1 gap-2">

          {DATA_SOURCES.map(source => {

            const active = activeDataSources.has(source.id)

            return (

              <li key={source.id}>

                <SourceToggle

                  source={source}

                  active={active}

                  onClick={() => onToggle(source.id)}

                />

              </li>

            )

          })}

        </ul>

      </div>

    </div>

  )

}

