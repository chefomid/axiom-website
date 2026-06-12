import { Link } from 'react-router-dom'
import Nav from './Nav'
import SiteFooter from './SiteFooter'

export default function LegalPageLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28 sm:px-8">
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-white"
        >
          ← Back to home
        </Link>
        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200/80">
          Draft template, requires legal review before publication
        </p>
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
