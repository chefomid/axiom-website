import { useState } from 'react'

import { INTELLIGENCE_SOURCE_CHIP_LABELS } from '../../data/intelligenceSources'
import IntelligenceSourcesModal from './IntelligenceSourcesModal'

const REVIEW_ITEMS = [

  'Property Identity',

  'Building Characteristics',

  'Construction Indicators',

  'Occupancy Signals',

  'Protection Factors',

  'Hazard Context',

  'Data Quality Flags',

]



const SOURCE_DISCIPLINE = ['Verified', 'Inferred', 'Missing', 'Needs Review']



const DELIVERABLES = [

  'Property Summary',

  'COPE Profile',

  'Hazard Snapshot',

  'Broker Notes',

  'PDF Report',

]



function CompactList({ items }) {

  return (

    <ul className="side-panel-list">

      {items.map(item => (

        <li key={item} className="side-panel-row">

          <span>{item}</span>

        </li>

      ))}

    </ul>

  )

}



export default function IntelligencePanelContent() {

  const [sourcesOpen, setSourcesOpen] = useState(false)



  return (

    <div className="shrink-0">

      <section className="side-panel-section shrink-0 border-b-0 pb-1">

        <span className="side-panel-title mb-0">Intelligence Panel</span>

      </section>



      <section className="side-panel-section shrink-0 border-b-0 py-2">

        <p className="text-[12px] font-medium leading-snug text-white/88">

          Property intelligence without the scattered search.

        </p>

        <p className="side-panel-copy mt-1.5">

          Location, hazard, and COPE indicators in one structured insurance view.

        </p>

      </section>



      <section className="side-panel-section shrink-0 border-b-0 pt-2 pb-0">

        <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9AA0A8]">

          Coverage &amp; Discipline

        </h3>

        <div className="im-accent-rule my-2" aria-hidden />

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">

          <div className="min-w-0">

            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/38">

              What AXIOM Reviews

            </p>

            <CompactList items={REVIEW_ITEMS} />

          </div>

          <div className="min-w-0">

            <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/38">

              Source Discipline

            </p>

            <CompactList items={SOURCE_DISCIPLINE} />

          </div>

        </div>

        <div className="mt-4 border-t border-white/[0.06] pt-4">

          <div className="mb-1.5 flex items-center justify-between gap-2">

            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/38">

              Sources

            </p>

            <button

              type="button"

              onClick={() => setSourcesOpen(true)}

              className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/42 transition hover:text-white/78"

            >

              Learn more

            </button>

          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">

            {INTELLIGENCE_SOURCE_CHIP_LABELS.map(item => (

              <span key={item} className="workflow-sidebar__deliverable-chip">

                {item}

              </span>

            ))}

          </div>

          <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/38">

            Deliverables

          </p>

          <div className="flex flex-wrap gap-1.5">

            {DELIVERABLES.map(item => (

              <span key={item} className="workflow-sidebar__deliverable-chip">

                {item}

              </span>

            ))}

          </div>

        </div>

      </section>

      <IntelligenceSourcesModal open={sourcesOpen} onClose={() => setSourcesOpen(false)} />

    </div>

  )

}

