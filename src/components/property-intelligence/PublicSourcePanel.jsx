import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { discoverSourceUrls, fetchPropertyEnvStatus, sourcesNeedingUrlIds } from '../../services/propertyApi'
import { formatRateLimitMessage, isRateLimitError } from '../../utils/apiErrors'

const LABELS = {
  assessor_crawl: 'County assessor page',
  permit_crawl: 'Permit portal',
}

const PLACEHOLDERS = {
  assessor_crawl: 'Auto-discovered on generate',
  permit_crawl: 'Auto-discovered on generate',
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
  variant = 'sidebar',
}) {
  const neededIds = useMemo(
    () => sourcesNeedingUrlIds(catalog, selectedSources),
    [catalog, selectedSources],
  )
  const show = neededIds.length > 0

  const [envStatus, setEnvStatus] = useState(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverStatus, setDiscoverStatus] = useState(null)
  const [discovered, setDiscovered] = useState(null)

  const autoDiscoverKeyRef = useRef('')

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
    setDiscovered(null)
    setDiscoverStatus(null)
    autoDiscoverKeyRef.current = ''
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
    setDiscoverStatus(null)
    try {
      const res = await discoverSourceUrls({ address, selectedSources })
      setDiscovered(res)
      const foundCount = Object.keys(res?.urls ?? {}).length
      const warnings = Array.isArray(res?.warnings) ? res.warnings : []

      if (foundCount > 0) {
        const next = { ...(sourceUrls ?? {}) }
        for (const [sid, item] of Object.entries(res.urls)) {
          if (item?.url) next[sid] = item.url
        }
        onSourceUrlsChange(next)
        setDiscoverStatus({
          tone: 'stable',
          message:
            res?.message ??
            `Found ${foundCount} public record page${foundCount === 1 ? '' : 's'} for this address.`,
          warnings,
        })
      } else {
        setDiscoverStatus({
          tone: 'watch',
          message:
            res?.message ??
            'No preview URLs yet — portals will still resolve automatically when you generate.',
          warnings,
        })
      }
    } catch (err) {
      setDiscovered(null)
      if (isRateLimitError(err)) {
        const { title, safetyNote } = formatRateLimitMessage(err.rateLimit)
        setDiscoverStatus({
          tone: 'watch',
          message: title,
          safetyNote,
          warnings: [],
        })
      } else {
        setDiscoverStatus({
          tone: 'watch',
          message: 'Preview unavailable — portals still resolve automatically on generate.',
          warnings: [],
        })
      }
    } finally {
      setDiscovering(false)
    }
  }, [address, selectedSources, sourceUrls, onSourceUrlsChange])

  useEffect(() => {
    if (!locationLocked || !address?.trim() || !openAiConfigured || discovering) return
    const key = `${address.trim()}|${neededIds.join('|')}`
    if (autoDiscoverKeyRef.current === key) return
    autoDiscoverKeyRef.current = key
    handleDiscover()
  }, [locationLocked, address, neededIds, openAiConfigured, discovering, handleDiscover])

  if (!show) return null

  const discoverDisabled = !locationLocked || disabled || discovering
  const isHud = variant === 'hud'

  return (
    <div className={isHud ? 'space-y-3 p-3' : 'space-y-3 border-b border-panel-border p-4'}>
      {!isHud ? (
        <div className="min-w-0">
          <p className="side-panel-title mb-0">Public Records</p>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
            Assessor and permit portals are discovered automatically when you generate. Preview is
            included at no extra charge.
          </p>
        </div>
      ) : (
        <p className="font-mono text-[9px] leading-relaxed text-ink-secondary">
          Public record pages resolve automatically on generate.
        </p>
      )}

      <div className="rounded-md border border-panel-border/70 bg-panel-surface/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[9px] leading-relaxed text-ink-secondary">
            {discovering
              ? 'Looking up public record sources…'
              : 'See which portals will be used for this address.'}
          </p>
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discoverDisabled}
            className="shrink-0 rounded border border-panel-border bg-black/40 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-wider text-ink-secondary transition hover:border-command-live/40 hover:text-white disabled:opacity-40"
          >
            {discovering ? '…' : 'Preview'}
          </button>
        </div>

        {discoverStatus ? (
          <div className="mt-2">
            <p
              className={`font-mono text-[9px] leading-relaxed ${
                discoverStatus.tone === 'stable' ? 'text-command-stable' : 'text-command-watch'
              }`}
            >
              {discoverStatus.message}
            </p>
            {discoverStatus.safetyNote ? (
              <p className="mt-1 font-mono text-[8px] leading-snug text-ink-faint">
                {discoverStatus.safetyNote}
              </p>
            ) : null}
          </div>
        ) : null}

        {discoverStatus?.warnings?.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {discoverStatus.warnings.map(warning => (
              <li key={warning} className="font-mono text-[8px] leading-snug text-command-watch">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
          Override (optional)
        </p>
        {neededIds.map(sourceId => (
          <div key={sourceId}>
            <label className="mb-1 block font-mono text-[9px] text-ink-secondary">
              {LABELS[sourceId] ?? sourceId}
            </label>
            <input
              type="url"
              value={sourceUrls?.[sourceId] ?? ''}
              onChange={e => setOneUrl(sourceId, e.target.value)}
              disabled={disabled}
              placeholder={PLACEHOLDERS[sourceId] ?? 'Leave blank for automatic discovery'}
              className="w-full rounded border border-panel-border bg-black/40 px-2.5 py-2 font-mono text-[10px] text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none disabled:opacity-40"
            />
            {discovered?.urls?.[sourceId]?.url ? (
              <p className="mt-1 font-mono text-[8px] text-ink-faint">
                Preview: {domainLabel(discovered.urls[sourceId].url)} (
                {discovered.urls[sourceId].confidence})
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
