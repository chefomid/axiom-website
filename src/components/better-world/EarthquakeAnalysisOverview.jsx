import { Link } from 'react-router-dom'
import Nav from '../Nav'
import SiteFooter from '../SiteFooter'
import StatusChip from './StatusChip'
import { useIsLgUp } from '../../hooks/useMediaQuery'
import { PUBLIC_DATA_COMMAND_PATH } from '../../constants/routes'

const CAPABILITIES = [
  { label: 'Frequency map', detail: 'USGS catalog density by place and time' },
  { label: 'Magnitude filters', detail: 'M2.5+ through stronger event presets' },
  { label: 'Radius search', detail: 'Local, national, or global catalog scope' },
  { label: 'Activity report', detail: 'Charts and a printable seismic summary' },
]

const REGIONS = [
  { id: 'US', label: 'United States' },
  { id: 'CA', label: 'Canada' },
  { id: 'MX', label: 'Mexico' },
  { id: 'JP', label: 'Japan' },
  { id: 'AU', label: 'Australia' },
  { id: 'GLOBAL', label: 'Global' },
]

const WORKFLOW = [
  { step: '01', title: 'Pick a place', body: 'Choose a country, pin an address, or scan the full catalog.' },
  { step: '02', title: 'Set the window', body: 'Timeline, radius, and minimum magnitude shape what you see.' },
  { step: '03', title: 'Read the pattern', body: 'Frequency stains, event points, and a report you can share.' },
]

function OverviewBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 right-[8%] h-[26rem] w-[26rem] rounded-full bg-[#ff9348]/[0.04] blur-3xl" />
      <div className="absolute bottom-[18%] -left-20 h-[22rem] w-[22rem] rounded-full bg-slate-200/[0.03] blur-3xl" />
      <div className="absolute left-[42%] top-[38%] h-px w-[38%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[8deg]" />
    </div>
  )
}

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
            <p className="font-display truncate text-sm font-semibold uppercase leading-tight tracking-[0.08em] text-white">
              Seismic/EQ Analysis
            </p>
          </div>
        </div>
        <StatusChip label="Desktop only" status="watch" />
      </div>
    </header>
  )
}

export default function EarthquakeAnalysisOverview() {
  const isLgUp = useIsLgUp()
  const desktopOnly = !isLgUp

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-black font-sans text-ink-primary">
      <OverviewBackground />
      {isLgUp ? <Nav /> : <MobileHeader />}

      <main
        className={`sleek-scrollbar flex-1 overflow-y-auto px-6 pb-10 sm:px-8 md:px-12 ${
          isLgUp ? 'pt-28 md:pt-32' : 'pt-8'
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <section className="border-b border-[#1a1a1a] pb-10 md:pb-14">
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip
                label={desktopOnly ? 'Desktop required' : 'Live'}
                status={desktopOnly ? 'watch' : 'stable'}
                pulse={!desktopOnly}
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {desktopOnly ? 'Open on desktop to access' : 'USGS catalog frequency analysis'}
              </p>
            </div>

            {desktopOnly ? (
              <div className="mt-6 rounded-lg border border-command-watch/35 bg-command-watch/[0.06] px-4 py-4 sm:px-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-command-watch">
                  Desktop access required
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Seismic/EQ Analysis is live on desktop. Visit this page on a computer with a screen at
                  least 1024px wide to run frequency maps, filters, and reports.
                </p>
              </div>
            ) : null}

            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-14">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">USGS seismic catalog</p>
                <h1 className="font-display mt-4 text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-white sm:text-4xl md:text-[2.65rem]">
                  Seismic/EQ Analysis
                </h1>
                <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
                  Frequency maps and magnitude filters from the USGS earthquake catalog. Pin a place,
                  set the window, and build a readable activity report.
                </p>
                <Link
                  to={PUBLIC_DATA_COMMAND_PATH}
                  className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint underline decoration-ink-faint/40 underline-offset-4 transition-colors hover:text-ink-secondary"
                >
                  Open Public Data Command
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[#1f1f1f] bg-[#1a1a1a]">
                {[
                  { value: 'USGS', label: 'Catalog' },
                  { value: '6', label: 'Regions' },
                  { value: 'M2.5+', label: 'Baseline' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#080808] px-4 py-5 text-center sm:px-5">
                    <p className="font-display text-lg font-semibold text-white sm:text-xl">{stat.value}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-10 md:py-14">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Workspace</p>
                <h2 className="font-display mt-3 text-xl font-medium text-white sm:text-2xl">
                  What you can run on desktop
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
                Built for a wide map and sidebar controls. Phone layouts cannot show the full workspace cleanly.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CAPABILITIES.map((item, index) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-4"
                >
                  <p className="font-mono text-[9px] tabular-nums text-ink-faint">0{index + 1}</p>
                  <p className="font-display mt-2 text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-[#141414] py-10 md:py-14">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Coverage</p>
            <h2 className="font-display mt-3 text-xl font-medium text-white sm:text-2xl">
              Regions with catalog analytics
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {REGIONS.map(region => (
                <li
                  key={region.id}
                  className="rounded-md border border-[#2a2a2a] bg-[#111] px-3.5 py-3"
                >
                  <p className="font-mono text-[10px] text-white">{region.label}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-ink-faint">{region.id}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-[#141414] py-10 md:py-14">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">How it works</p>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {WORKFLOW.map(item => (
                <li
                  key={item.step}
                  className="flex h-full flex-col rounded-lg border border-[#1f1f1f] bg-[#080808] px-5 py-5 sm:px-6"
                >
                  <span className="font-mono text-[10px] tabular-nums text-ink-faint">{item.step}</span>
                  <p className="font-display mt-3 text-base font-medium text-white">{item.title}</p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <SiteFooter className="mt-auto" />
    </div>
  )
}
