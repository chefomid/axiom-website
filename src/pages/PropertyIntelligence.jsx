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
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-2xl tracking-[0.2em] text-ink-muted uppercase">
          Coming Soon
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
