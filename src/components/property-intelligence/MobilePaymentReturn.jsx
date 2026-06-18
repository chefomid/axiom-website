import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  checkPropertyApiHealth,
  discoverSourceUrls,
  enrichBatch,
  enrichProperty,
  fetchCheckoutResume,
  fetchCheckoutStatus,
} from '../../services/propertyApi'
import { adoptAnonIdFromSearchParams, getOrCreateAnonId } from '../../utils/anonId'

import BatchResultsPanel from './BatchResultsPanel'
import ReportResultsPanel from './ReportResultsPanel'

function MobileShell({ children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black font-sans text-ink-primary">
      <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#2a2a2a] text-ink-muted transition-colors hover:border-[#444] hover:text-white"
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
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">Property Intelligence</p>
            <p className="font-display truncate text-sm font-semibold text-white">Your report</p>
          </div>
        </div>
      </header>
      <main className="sleek-scrollbar flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function StatusBanner({ children, tone = 'live' }) {
  const toneClass =
    tone === 'error'
      ? 'border-command-critical/40 bg-command-critical/10 text-command-critical'
      : 'border-command-live/40 bg-command-live/10 text-command-live'
  return (
    <div className={`mx-4 mt-4 rounded-lg border px-4 py-3 font-sans text-sm leading-relaxed ${toneClass}`}>
      {children}
    </div>
  )
}

export default function MobilePaymentReturn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [phase, setPhase] = useState('verifying')
  const [error, setError] = useState(null)
  const [record, setRecord] = useState(null)
  const [batchRun, setBatchRun] = useState(null)
  const [discoverResult, setDiscoverResult] = useState(null)
  const [addressLabel, setAddressLabel] = useState('')
  const [apiOnline, setApiOnline] = useState(null)

  const sessionId = searchParams.get('session_id')?.trim() ?? ''
  const billing = searchParams.get('billing')

  const clearParams = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('billing')
    next.delete('session_id')
    next.delete('anon_id')
    next.delete('resume')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    adoptAnonIdFromSearchParams(searchParams)
    checkPropertyApiHealth()
      .then(setApiOnline)
      .catch(() => setApiOnline(false))
  }, [searchParams])

  useEffect(() => {
    if (billing !== 'success' || !sessionId) {
      setPhase('error')
      setError('Invalid payment return link.')
      return undefined
    }

    let cancelled = false
    const anonId = getOrCreateAnonId()

    async function waitForPaid() {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const status = await fetchCheckoutStatus(sessionId, anonId)
        if (status.status === 'paid') return true
        await new Promise(resolve => window.setTimeout(resolve, 2000))
        if (cancelled) return false
      }
      return false
    }

    async function run() {
      try {
        const paid = await waitForPaid()
        if (cancelled) return
        if (!paid) {
          setPhase('error')
          setError('Payment not confirmed yet. Return to your desktop or try again in a moment.')
          return
        }

        const { purpose, resume } = await fetchCheckoutResume(sessionId, anonId)
        if (cancelled) return

        const selectedSources = resume.selected_sources ?? []
        const sourceUrls = resume.source_urls ?? {}
        const confirmedPriceUsd = resume.confirmed_price_usd ?? null

        setPhase('running')

        if (purpose === 'enrich') {
          const addr = (resume.address ?? '').trim()
          setAddressLabel(addr)
          const result = await enrichProperty({
            address: addr,
            selectedSources,
            sourceUrls,
            confirmedPriceUsd,
          })
          if (cancelled) return
          setRecord(result)
        } else if (purpose === 'batch_enrich') {
          const addresses = resume.addresses ?? []
          setAddressLabel(addresses[0] ?? '')
          const result = await enrichBatch({
            addresses,
            selectedSources,
            confirmedPriceUsd,
          })
          if (cancelled) return
          setBatchRun(result)
        } else if (purpose === 'discover') {
          const addr = (resume.address ?? '').trim()
          setAddressLabel(addr)
          const result = await discoverSourceUrls({
            address: addr,
            selectedSources,
          })
          if (cancelled) return
          setDiscoverResult(result)
        }

        setPhase('done')
        clearParams()
      } catch (err) {
        if (cancelled) return
        setPhase('error')
        setError(err?.message ?? 'Something went wrong while loading your report.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [billing, sessionId, clearParams])

  if (phase === 'verifying') {
    return (
      <MobileShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <span className="street-view-spinner mb-4 h-5 w-5" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">Confirming payment</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">This usually takes a few seconds.</p>
        </div>
      </MobileShell>
    )
  }

  if (phase === 'error') {
    return (
      <MobileShell>
        <StatusBanner tone="error">{error}</StatusBanner>
        <p className="mx-4 mt-4 font-sans text-sm leading-relaxed text-ink-secondary">
          If you paid on your phone, your desktop session should update shortly. For the full map workflow, open
          Property Intelligence on a desktop browser.
        </p>
        <Link
          to="/property-intelligence"
          className="mx-4 mt-6 inline-flex min-h-[44px] items-center justify-center rounded border border-panel-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary no-underline"
        >
          Back to overview
        </Link>
      </MobileShell>
    )
  }

  if (phase === 'running') {
    return (
      <MobileShell>
        <StatusBanner>Payment received. Generating your report…</StatusBanner>
        {addressLabel ? (
          <p className="mx-4 mt-3 truncate font-sans text-sm text-ink-secondary">{addressLabel}</p>
        ) : null}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <span className="street-view-spinner h-5 w-5" aria-hidden />
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <StatusBanner>Payment received. Your report is ready.</StatusBanner>
      {addressLabel ? (
        <p className="mx-4 mt-3 truncate font-sans text-sm text-ink-secondary">{addressLabel}</p>
      ) : null}
      <p className="mx-4 mt-2 font-sans text-xs leading-relaxed text-ink-faint">
        For the full map workflow, continue on desktop at{' '}
        <span className="text-ink-secondary">axiompropertycasualty.com/property-intelligence</span>.
      </p>

      {record ? (
        <div className="mt-4 border-t border-panel-border">
          <ReportResultsPanel
            record={record}
            loading={false}
            error={null}
            apiOnline={apiOnline}
            variant="panel"
            showHeader={false}
          />
        </div>
      ) : null}

      {batchRun ? (
        <div className="mt-4 border-t border-panel-border">
          <BatchResultsPanel batchRun={batchRun} loading={false} error={null} apiOnline={apiOnline} />
        </div>
      ) : null}

      {discoverResult ? (
        <div className="mx-4 mt-4 rounded-lg border border-panel-border bg-panel-surface/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">AI URL discovery</p>
          <p className="mt-2 font-sans text-sm text-ink-secondary">
            Discovery completed. Open Property Intelligence on desktop to review and apply suggested URLs.
          </p>
          {Array.isArray(discoverResult.suggestions) && discoverResult.suggestions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {discoverResult.suggestions.slice(0, 5).map(item => (
                <li key={item.source_id ?? item.url} className="font-mono text-[10px] text-ink-faint break-all">
                  {item.source_id}: {item.url}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </MobileShell>
  )
}
