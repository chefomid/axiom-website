import { Link } from 'react-router-dom'
import Nav from '../Nav'
import StatusChip from '../better-world/StatusChip'
import { useIsLgUp } from '../../hooks/useMediaQuery'

const GOVERNMENT_FEEDS = [
  { id: 'fema', label: 'FEMA', detail: 'Flood zones', logo: '/data-sources/fema.svg' },
  { id: 'usgs', label: 'USGS', detail: 'Earthquakes', logo: '/data-sources/usgs.svg' },
  { id: 'nws', label: 'NWS', detail: 'Weather alerts', logo: '/data-sources/nws.svg' },
  { id: 'epa', label: 'EPA', detail: 'Environmental', logo: null },
]

const LICENSED_APIS = [
  { name: 'ATTOM', hook: 'Insurance-grade property facts' },
  { name: 'Melissa', hook: 'Assessor-aligned records' },
  { name: 'RentCast', hook: 'Sqft, year built, sales' },
  { name: 'First Street', hook: 'Flood, fire, and heat risk' },
]

const COPE_PILLARS = ['Construction', 'Occupancy', 'Protection', 'Exposure']

const WORKFLOW = [
  { step: '01', title: 'Drop a pin', body: 'Search an address and lock the site on the map.' },
  { step: '02', title: 'Pick your stack', body: 'Government hazard feeds plus licensed property APIs.' },
  { step: '03', title: 'Get the dossier', body: 'A cited COPE report with pricing shown upfront.' },
]

function MobileHeader() {
  return (
    <header className="mobile-feed-sticky shrink-0 border-b border-panel-border bg-[#060606]/95 px-4 py-2.5 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#2a2a2a] text-ink-muted transition-colors hover:border-[#444] hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M11 4L6 9l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="min-w-0">
            <Link
              to="/"
              className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-white"
            >
              Home
            </Link>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white leading-tight truncate">
              Property Intelligence
            </p>
          </div>
        </div>
        <StatusChip label="Preview" status="stable" />
      </div>
    </header>
  )
}

function SourcePanel({ label, note, children }) {
  return (
    <div className="bg-[#080808] p-6 sm:p-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">{label}</p>
        {note && (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">{note}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function PropertyIntelligenceOverview({ comingSoon = true }) {
  const isLgUp = useIsLgUp()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-ink-primary font-sans">
      {isLgUp ? <Nav /> : <MobileHeader />}

      <main
        className={`sleek-scrollbar flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 ${
          isLgUp ? 'pt-28 md:pt-32' : 'pt-6'
        }`}
      >
        <div className="mx-auto max-w-2xl space-y-10">
          {comingSoon && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#1a1a1a] pb-6">
              <StatusChip label="Coming soon" status="watch" />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Desktop workspace in development
              </p>
            </div>
          )}

          <section className="max-w-xl">
            <p className="text-xs tracking-[0.3em] text-ink-muted uppercase">
              Address-level COPE
            </p>
            <h1 className="font-display mt-4 text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl text-balance">
              Property Intelligence
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg text-pretty">
              COPE dossiers from a single address. Public hazard feeds and licensed property data,
              cited in one report.
            </p>
          </section>

          <div className="grid gap-px bg-[#1a1a1a] md:grid-cols-2">
            <SourcePanel label="Government hazard feeds" note="Public · Live">
              <ul className="grid grid-cols-2 gap-2">
                {GOVERNMENT_FEEDS.map(feed => (
                  <li
                    key={feed.id}
                    className="flex items-center gap-2.5 rounded border border-[#2a2a2a] bg-[#111] px-2.5 py-2.5"
                  >
                    {feed.logo ? (
                      <img
                        src={feed.logo}
                        alt=""
                        className="h-5 w-5 shrink-0 object-contain opacity-90"
                      />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[7px] text-ink-faint">
                        EPA
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-white">{feed.label}</p>
                      <p className="truncate font-mono text-[9px] text-ink-faint">{feed.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </SourcePanel>

            <SourcePanel label="Licensed property APIs" note="À la carte">
              <ul className="space-y-2">
                {LICENSED_APIS.map(api => (
                  <li
                    key={api.name}
                    className="rounded border border-[#2a2a2a] bg-[#111] px-3 py-2.5"
                  >
                    <p className="font-display text-sm text-white">{api.name}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{api.hook}</p>
                  </li>
                ))}
              </ul>
            </SourcePanel>
          </div>

          <section>
            <p className="text-xs tracking-[0.3em] text-ink-muted uppercase">COPE</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {COPE_PILLARS.map(pillar => (
                <span
                  key={pillar}
                  className="rounded border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-secondary"
                >
                  {pillar}
                </span>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs tracking-[0.3em] text-ink-muted uppercase">How it works</p>
            <ol className="mt-4 space-y-px bg-[#1a1a1a]">
              {WORKFLOW.map(item => (
                <li
                  key={item.step}
                  className="flex gap-4 bg-[#080808] px-5 py-4 sm:px-6"
                >
                  <span className="font-mono text-[10px] tabular-nums text-ink-faint pt-0.5">
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {!comingSoon && !isLgUp && (
            <p className="text-sm leading-relaxed text-ink-muted">
              The full workspace runs on desktop (1024px or wider).
            </p>
          )}

          {comingSoon && isLgUp && (
            <p className="text-sm text-ink-faint">Launching on desktop first.</p>
          )}

          <div className="border-t border-[#141414] pt-8">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted transition-colors hover:text-white"
            >
              ← Back to AXIOM
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
