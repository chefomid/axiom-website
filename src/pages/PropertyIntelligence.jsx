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
      <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-3xl flex-col justify-center px-8 pb-20 pt-24 md:px-20">
        <p className="font-display text-4xl font-semibold uppercase tracking-[0.14em] text-white md:text-6xl md:tracking-[0.12em]">
          Coming Soon
        </p>
        <h1 className="font-display mt-5 text-xl font-medium tracking-tight text-ink-secondary md:text-2xl">
          Property Intelligence
        </h1>
        <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg">
          Address-level property and casualty intelligence for underwriting and risk control—COPE,
          peril and crime context, reconciled from insurance-grade public and private sources in one
          defensible receipt. Part of the AXIOM ecosystem for holistic enterprise risk management.
        </p>
        <div className="mt-14 h-px w-16 bg-[#333]" aria-hidden />
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
