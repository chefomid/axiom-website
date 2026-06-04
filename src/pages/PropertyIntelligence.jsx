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
      <main className="flex min-h-[calc(100vh-5.5rem)] flex-col pt-24">
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-2xl uppercase tracking-[0.2em] text-ink-muted md:text-3xl">
            Coming Soon
          </p>
        </div>
        <div className="max-w-3xl px-8 pb-12 text-left md:px-20 md:pb-16">
          <p className="font-display text-sm text-white">Property Intelligence</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
            AXIOM Property Intelligence is address-level property and casualty risk analysis for
            insurance and risk management: building and occupancy characteristics, natural hazards,
            crime, and related exposure in one attributed report. Public government data and
            licensed commercial property sources are used where available and clearly cited. This
            application is in development and is not yet available on this website.
          </p>
        </div>
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
