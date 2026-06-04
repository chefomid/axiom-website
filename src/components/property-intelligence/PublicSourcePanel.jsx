import { useCallback, useEffect, useMemo, useState } from 'react'

import { SegmentButton } from '../ui/CommandControls'
import { discoverSourceUrls, fetchPropertyEnvStatus, formatUsd, isPaymentRequiredError, sourcesNeedingUrlIds } from '../../services/propertyApi'

const LABELS = {
  assessor_crawl: 'County assessor page',
  permit_crawl: 'Permit portal',
}

const PLACEHOLDERS = {
  assessor_crawl: 'https://county-assessor.example.gov/parcel/…',
  permit_crawl: 'https://city.gov/permits/search/…',
}

function domainLabel(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export default function PublicSourcePanel({
  catalog,
  selectedSources,
  address,
  locationLocked,
  apiOnline,
  disabled,
  sourceUrls,
  onSourceUrlsChange,
  onPaymentRequired,
  variant = 'sidebar',
}) {
  const neededIds = useMemo(
    () => sourcesNeedingUrlIds(catalog, selectedSources),
    [catalog, selectedSources],
  )
  const show = neededIds.length > 0

  const [mode, setMode] = useState('manual')
  const [envStatus, setEnvStatus] = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState(null)
  const [discovered, setDiscovered] = useState(null)

  const openAiConfigured = Boolean(envStatus?.configured?.includes('OPENAI_API_KEY'))

  useEffect(() => {
    if (!apiOnline) {
      setEnvStatus(null)
      return undefined
    }
    let cancelled = false
    fetchPropertyEnvStatus()
      .then(data => {
        if (!cancelled) setEnvStatus(data)
      })
      .catch(() => {
        if (!cancelled) setEnvStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline])

  useEffect(() => {
    // Clear stale discoveries when address/sources change.
    setDiscovered(null)
    setDiscoverError(null)
  }, [address, neededIds.join('|')])

  const setOneUrl = useCallback(
    (sourceId, value) => {
      const next = { ...(sourceUrls ?? {}) }
      if (value?.trim()) next[sourceId] = value
      else delete next[sourceId]
      onSourceUrlsChange(next)
    },
    [sourceUrls, onSourceUrlsChange],
  )

  const handleDiscover = useCallback(async () => {
    if (!address?.trim()) return
    setDiscovering(true)
    setDiscoverError(null)
    try {
      const res = await discoverSourceUrls({ address, selectedSources })
      setDiscovered(res)
      if (res?.urls && Object.keys(res.urls).length > 0) {
        const next = { ...(sourceUrls ?? {}) }
        for (const [sid, item] of Object.entries(res.urls)) {
          if (item?.url) next[sid] = item.url
        }
        onSourceUrlsChange(next)
      }
      if (res?.message) setDiscoverError(res.message)
    } catch (err) {
      setDiscovered(null)
      if (isPaymentRequiredError(err)) {
        setDiscoverError('Insufficient credits — add credits to continue.')
        onPaymentRequired?.(err)
      } else {
        setDiscoverError(err?.message ?? 'AI discovery failed')
      }
    } finally {
      setDiscovering(false)
    }
  }, [address, selectedSources, sourceUrls, onSourceUrlsChange, onPaymentRequired])

  if (!show) return null

  const receipt = discovered?.receipt
  const discoverDisabled = !locationLocked || disabled || discovering || !openAiConfigured
  const isHud = variant === 'hud'

  return (
    <div className={isHud ? 'space-y-3 p-3' : 'space-y-3 border-b border-panel-border p-4'}>
      {!isHud ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Public record pages</p>
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
              Required for selected crawl sources. Public pages only.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <SegmentButton active={mode === 'manual'} onClick={() => setMode('manual')}>
          Enter manually
        </SegmentButton>
        <SegmentButton
          active={mode === 'assisted'}
          onClick={() => setMode('assisted')}
          disabled={!openAiConfigured}
          title={!openAiConfigured ? 'Add OPENAI_API_KEY on the server to enable AI discovery.' : undefined}
        >
          Find with AI
        </SegmentButton>
      </div>

      {mode === 'assisted' ? (
        <div className="rounded-md border border-panel-border/70 bg-panel-surface/30 p-3">
          <p className="font-mono text-[9px] leading-relaxed text-ink-secondary">
            AI-assisted search uses OpenAI web search. No login required. Costs are shown before you run a report.
          </p>

          {!openAiConfigured ? (
            <div className="mt-3 rounded-md border border-command-watch/30 bg-command-watch/5 p-2.5">
              <p className="font-mono text-[9px] leading-relaxed text-ink-secondary">
                AI discovery unavailable — add <code className="text-white">OPENAI_API_KEY</code> to server{' '}
                <code className="text-white">.env</code>.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discoverDisabled}
              className="rounded border border-command-live/50 bg-command-live/15 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-command-live transition hover:bg-command-live/25 disabled:opacity-40"
            >
              {discovering ? 'Finding…' : 'Find public pages'}
            </button>
            {receipt ? (
              <span className="shrink-0 font-mono text-[9px] text-ink-faint">
                Find pages — {formatUsd(receipt.user_price_usd)}
              </span>
            ) : null}
          </div>

          {discoverError ? (
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-command-watch">{discoverError}</p>
          ) : null}

          {discovered?.cached ? (
            <p className="mt-2 font-mono text-[9px] text-ink-faint">Using cached discovery result.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {neededIds.map(sourceId => (
          <div key={sourceId}>
            <label
              htmlFor={`property-source-url-${sourceId}`}
              className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted"
            >
              {LABELS[sourceId] ?? sourceId}
            </label>
            <input
              id={`property-source-url-${sourceId}`}
              type="url"
              value={sourceUrls?.[sourceId] ?? ''}
              onChange={e => setOneUrl(sourceId, e.target.value)}
              placeholder={PLACEHOLDERS[sourceId] ?? 'https://…'}
              className="w-full rounded border border-panel-border bg-panel-surface px-3 py-2 font-mono text-xs text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/30"
              disabled={disabled}
            />
            {discovered?.urls?.[sourceId]?.url ? (
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
                Suggested: {domainLabel(discovered.urls[sourceId].url)} ({discovered.urls[sourceId].confidence})
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

