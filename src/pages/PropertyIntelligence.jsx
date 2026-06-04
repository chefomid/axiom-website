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
        <div className="flex flex-1 items-center justify-center px-8">
          <p className="font-display text-2xl tracking-wide text-ink-secondary md:text-3xl">
            Coming soon
          </p>
        </div>
        <div className="px-8 pb-12 text-center md:pb-16">
          <p className="font-display text-sm text-white">Property Intelligence</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            We are building a simple way to look up property risk at any address. You will see
            building details, natural hazards, crime, and more in one place, using trusted public
            and professional data sources. Built for insurance and risk teams, from AXIOM.
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
