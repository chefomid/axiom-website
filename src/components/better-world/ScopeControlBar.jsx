import { COUNTRIES } from '../../data/commandMapData'

import { ScopePill } from '../ui/CommandControls'



export default function ScopeControlBar({

  scope,

  radiusMiles,

  countryId,

  userLocation,

  eventCount,

  onOpenModal,

}) {

  const countryLabel = COUNTRIES.find(c => c.id === countryId)?.label ?? countryId



  const scopeSummary = () => {

    if (scope === 'local') {

      if (!userLocation) return 'Local · set location'

      return `Local · ${radiusMiles} mi · ${eventCount} pts`

    }

    if (scope === 'national') return `National · ${countryLabel} · ${eventCount} pts`

    return `Global · ${eventCount} pts`

  }



  return (

    <div className="absolute left-3 top-3 z-20 sm:left-4">

      <ScopePill label="Scope" value={scopeSummary()} onClick={onOpenModal} />

    </div>

  )

}

