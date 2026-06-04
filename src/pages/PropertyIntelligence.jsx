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
      <main className="flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-8 pb-16 pt-28 md:px-20">
        <article className="w-full max-w-lg">
          <header className="text-center">
            <p className="font-display text-2xl uppercase tracking-[0.2em] text-ink-muted md:text-3xl">
              Coming Soon
            </p>
          </header>
          <div className="mx-auto mt-10 h-px w-14 bg-[#333]" aria-hidden />
          <p className="mt-10 text-left text-sm leading-relaxed text-ink-muted md:text-[15px]">
            AXIOM Property Intelligence is address-level property and casualty risk analysis for
            insurance and risk management: building and occupancy characteristics, natural hazards,
            crime, and related exposure in one attributed report. Public government data and
            licensed commercial property sources are used where available and clearly cited. This
            application is in development and is not yet available on this website.
          </p>
        </article>
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
