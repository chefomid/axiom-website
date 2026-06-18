import { motion, AnimatePresence } from 'framer-motion'
import { PrimaryButton } from '../ui/CommandControls'
import MobileStickyFooter from '../ui/MobileStickyFooter'

export const PI_INTRO_ACK_KEY = 'axiom:pi-intro-ack'

export function isPropertyIntelligenceIntroAcked() {
  try {
    return sessionStorage.getItem(PI_INTRO_ACK_KEY) === 'true'
  } catch {
    return false
  }
}

export function ackPropertyIntelligenceIntro() {
  try {
    sessionStorage.setItem(PI_INTRO_ACK_KEY, 'true')
  } catch {
    /* sessionStorage unavailable */
  }
}

const FEATURED_VENDOR_IDS = ['attom', 'melissa', 'rentcast', 'firststreet']

const FALLBACK_VENDORS = {
  attom: {
    name: 'ATTOM Data',
    tagline: 'Licensed property characteristics',
  },
  melissa: {
    name: 'Melissa',
    tagline: '140M+ assessor-aligned property records',
  },
  rentcast: {
    name: 'RentCast',
    tagline: 'Sqft, year built, and sale history',
  },
  firststreet: {
    name: 'First Street Foundation',
    tagline: 'Property-level flood, fire, and heat risk',
  },
}

const GOVERNMENT_SOURCES = ['FEMA', 'USGS', 'NWS', 'EPA']

const COPE_VECTOR = [
  { label: 'Construction', detail: 'Building type, year built, roof' },
  { label: 'Occupancy', detail: 'Use class, units, owner' },
  { label: 'Protection', detail: 'Hydrants, fire stations, distance' },
  { label: 'Exposure', detail: 'Flood, quake, wildfire, weather' },
]

function IntroBody({ featured }) {
  return (
    <>
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
        Address-level COPE enrichment
      </p>
      <h2
        id="pi-intro-title"
        className="font-display mt-1 text-xl font-semibold text-white sm:text-2xl"
      >
        Property Intelligence
      </h2>

      <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
        COPE-ready property intelligence: building characteristics, live hazards, and
        source-backed fields in one place.
      </p>

      <div className="mt-5 rounded border border-panel-border/70 bg-panel-surface/30 px-4 py-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-command-live">
          What to expect
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Licensed vendors cover 140M+ US properties with assessor-aligned records, building
          attributes, and peril scores. Live government feeds add flood zones, seismic activity,
          weather alerts, and environmental context at the pin. The Publicly Available package
          starts with these feeds at no vendor cost.
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
          Some fields may still come back blank: new construction, owner privacy rules, vendor
          update lag, or properties outside a feed&apos;s footprint are normal. AXIOM labels each
          field as verified, inferred, or missing so you see exactly what came back.
        </p>
      </div>

      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
        Licensed property APIs
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {featured.map(vendor => (
          <li
            key={vendor.id}
            className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2"
          >
            <p className="font-mono text-[10px] font-medium text-amber-100">{vendor.name}</p>
            <p className="mt-0.5 font-mono text-[9px] leading-snug text-ink-muted">
              {vendor.tagline}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
        Government hazard feeds
      </p>
      <p className="mt-1.5 font-mono text-[10px] tracking-wide text-ink-secondary">
        {GOVERNMENT_SOURCES.join(' · ')}
      </p>

      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
        COPE data vector
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {COPE_VECTOR.map(item => (
          <li
            key={item.label}
            className="rounded border border-panel-border/60 bg-black/40 px-2.5 py-2"
          >
            <p className="font-mono text-[9px] font-medium uppercase tracking-wide text-white">
              {item.label}
            </p>
            <p className="mt-0.5 font-mono text-[8px] leading-snug text-ink-faint">
              {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function PropertyIntelligenceIntroModal({ open, onContinue, vendors }) {
  const featured = FEATURED_VENDOR_IDS.map(id => ({
    id,
    ...(vendors?.[id] ?? FALLBACK_VENDORS[id]),
  }))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pi-intro-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md md:items-center md:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex max-h-[min(92dvh,100%)] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl md:max-h-none md:rounded md:border"
          >
            <div className="sleek-scrollbar flex-1 overflow-y-auto overscroll-contain p-5 md:p-6">
              <IntroBody featured={featured} />
              <div className="mt-6 hidden justify-end md:flex">
                <PrimaryButton onClick={onContinue}>Get started</PrimaryButton>
              </div>
            </div>

            <MobileStickyFooter fixed={false} align="end" className="md:hidden">
              <div className="w-full [&_button]:w-full">
                <PrimaryButton onClick={onContinue}>Get started</PrimaryButton>
              </div>
            </MobileStickyFooter>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
