import { useEffect } from 'react'
import Nav from '../components/Nav'

export default function PropertyIntelligence() {
  useEffect(() => {
    document.title = 'Property Intelligence — AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

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
