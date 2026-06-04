import { lazy, Suspense, useEffect } from 'react'
import Nav from '../components/Nav'
import { isPropertyIntelligenceEnabled } from '../config/features'

const PropertyIntelligenceView = lazy(() =>
  import('../components/property-intelligence/PropertyIntelligenceView')
)

function PropertyIntelligenceComingSoon() {
  return (
    <div className="min-h-screen bg-black text-ink-primary font-sans">
      <Nav />
      <main className="mx-auto max-w-3xl px-8 pb-24 pt-28 md:px-12 md:pt-32">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-200/90">
          Coming soon
        </p>
        <h1 className="font-display mt-4 text-3xl font-semibold leading-[1.12] tracking-tight text-white md:text-4xl">
          Property Intelligence
        </h1>
        <p className="mt-6 text-base leading-relaxed text-ink-secondary md:text-lg">
          AXIOM is building an address-level risk workspace for property and casualty—where
          underwriters, risk managers, and portfolio teams interrogate a location the way carriers
          actually do, with answers you can defend in a file.
        </p>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          The vision is comprehensive property risk analysis in one pass: COPE—construction,
          occupancy, protection, and exposure—reconciled against natural catastrophe, crime, and
          additional peril and behavioral signals we are layering in now. Not a scatter of tabs; a
          single intelligence receipt with provenance, conflict resolution, and tiering that respects
          how P&C workflows consume data.
        </p>

        <div className="mt-10 rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent px-5 py-5 md:px-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-200/90">
            Insurance-grade sources
          </p>
          <p className="mt-2 font-display text-lg leading-snug text-white">
            Public programs and licensed private feeds—together
          </p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-secondary">
            Authoritative government hazard, cadastral, and environmental layers alongside
            carrier-trusted property attribute and valuation data. Each source attributed, scoped for
            underwriting and risk control, and held to a standard that survives audit—not consumer
            map trivia.
          </p>
        </div>

        <p className="mt-8 font-mono text-[10px] leading-relaxed text-ink-faint">
          Property Intelligence is in active development and not yet available in production. The
          full experience—including configurable source packages and COPE-oriented reporting—ships
          when carrier workflows are ready.
        </p>
      </main>
    </div>
  )
}

export default function PropertyIntelligence() {
  const enabled = isPropertyIntelligenceEnabled()

  useEffect(() => {
    document.title = 'Property Intelligence — AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  if (!enabled) {
    return <PropertyIntelligenceComingSoon />
  }

  return (
    <Suspense fallback={null}>
      <PropertyIntelligenceView />
    </Suspense>
  )
}
