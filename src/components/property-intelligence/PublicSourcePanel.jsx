import { useCallback, useEffect, useMemo, useRef, useState } from 'react'



import { discoverSourceUrls, fetchBillingPacks, fetchCheckoutPreview, fetchPropertyEnvStatus, formatUsd, isPaymentRequiredError, sourcesNeedingUrlIds, startQuoteCheckout } from '../../services/propertyApi'
import { formatRateLimitMessage, isRateLimitError } from '../../utils/apiErrors'
import { useCheckoutPay } from '../../hooks/useCheckoutPay'



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

  onPaymentRequired,

  billingEnabled: billingEnabledProp = null,

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

  const [billingEnabledLocal, setBillingEnabledLocal] = useState(false)

  const [discoverPreview, setDiscoverPreview] = useState(null)

  const [payLoading, setPayLoading] = useState(false)

  const billingEnabled = billingEnabledProp ?? billingEnabledLocal
  const { presentCheckout } = useCheckoutPay()

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

    if (billingEnabledProp != null) return undefined

    if (!apiOnline) {

      setBillingEnabledLocal(false)

      return undefined

    }

    let cancelled = false

    fetchBillingPacks()

      .then(data => {

        if (!cancelled) setBillingEnabledLocal(Boolean(data.billing_enabled))

      })

      .catch(() => {

        if (!cancelled) setBillingEnabledLocal(false)

      })

    return () => {

      cancelled = true

    }

  }, [apiOnline, billingEnabledProp])



  useEffect(() => {

    if (!billingEnabled || !locationLocked || !address?.trim()) {

      setDiscoverPreview(null)

      return undefined

    }

    let cancelled = false

    fetchCheckoutPreview({

      purpose: 'discover',

      address,

      selectedSources,

    })

      .then(data => {

        if (!cancelled) setDiscoverPreview(data)

      })

      .catch(() => {

        if (!cancelled) setDiscoverPreview(null)

      })

    return () => {

      cancelled = true

    }

  }, [billingEnabled, locationLocked, address, selectedSources])



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

            `Preview: found ${foundCount} public record page${foundCount === 1 ? '' : 's'} for this address.`,

          warnings,

        })

      } else {

        setDiscoverStatus({

          tone: 'watch',

          message:

            res?.message ??

            'Preview: portals will be resolved automatically when you generate.',

          warnings,

        })

      }

    } catch (err) {

      setDiscovered(null)

      if (isPaymentRequiredError(err)) {

        setDiscoverStatus({

          tone: 'watch',

          message: billingEnabled

            ? discoverPreview && !discoverPreview.sufficient

              ? `Pay ${formatUsd(discoverPreview.charge_usd)} below to preview discovery.`

              : 'Insufficient credits, add credits to preview discovery.'

            : 'Dry run, wallet billing not configured on the server.',

          warnings: [],

        })

        onPaymentRequired?.(err)

      } else if (isRateLimitError(err)) {

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

          message: 'Preview unavailable, portals still resolve automatically on generate.',

          warnings: [],

        })

      }

    } finally {

      setDiscovering(false)

    }

  }, [address, selectedSources, sourceUrls, onSourceUrlsChange, onPaymentRequired, billingEnabled, discoverPreview])



  const handlePayAndDiscover = useCallback(() => {
    if (!address?.trim()) return

    presentCheckout({
      title: 'AI URL discovery preview',
      charge_usd: discoverPreview?.charge_usd,
      credits_to_add: discoverPreview?.credits_to_add,
      fetchPreview:
        discoverPreview?.credits_to_add != null
          ? undefined
          : () =>
              fetchCheckoutPreview({
                purpose: 'discover',
                address,
                selectedSources,
              }),
      fetchSession: embedded =>
        startQuoteCheckout({
          purpose: 'discover',
          address,
          selectedSources,
          resumeContext: {
            address: address.trim(),
            selectedSources,
            sourceUrls,
          },
          embedded,
        }),
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('axiom:billing-resume-discover'))
      },
    })
  }, [address, selectedSources, sourceUrls, discoverPreview, presentCheckout])



  useEffect(() => {

    const onResume = () => {

      handleDiscover()

    }

    window.addEventListener('axiom:billing-resume-discover', onResume)

    return () => window.removeEventListener('axiom:billing-resume-discover', onResume)

  }, [handleDiscover])



  useEffect(() => {

    if (!locationLocked || !address?.trim() || !openAiConfigured || discovering) return

    const key = `${address.trim()}|${neededIds.join('|')}`

    if (autoDiscoverKeyRef.current === key) return

    autoDiscoverKeyRef.current = key

    handleDiscover()

  }, [locationLocked, address, neededIds, openAiConfigured, discovering, handleDiscover])



  if (!show) return null



  const receipt = discovered?.receipt

  const discoverDisabled = !locationLocked || disabled || discovering || payLoading

  const needsDiscoverPay =

    billingEnabled && discoverPreview && !discoverPreview.sufficient && discoverPreview.charge_usd > 0

  const isHud = variant === 'hud'



  return (

    <div className={isHud ? 'space-y-3 p-3' : 'space-y-3 border-b border-panel-border p-4'}>

      {!isHud ? (

        <div className="min-w-0">

          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">Public records</p>

          <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">

            Assessor and permit portals are discovered automatically when you generate.

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

              ? 'Previewing public record sources…'

              : 'Optional: preview which portals will be used.'}

          </p>

          <button

            type="button"

            onClick={needsDiscoverPay ? handlePayAndDiscover : handleDiscover}

            disabled={discoverDisabled}

            className="shrink-0 rounded border border-panel-border bg-black/40 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-wider text-ink-secondary transition hover:border-command-live/40 hover:text-white disabled:opacity-40"

          >

            {payLoading

              ? '…'

              : discovering

                ? '…'

                : needsDiscoverPay

                  ? `Pay ${formatUsd(discoverPreview.charge_usd)} & Preview`

                  : 'Preview'}

          </button>

        </div>

        {receipt ? (

          <p className="mt-2 font-mono text-[8px] text-ink-faint">Preview cost: {formatUsd(receipt.user_price_usd)}</p>

        ) : null}

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

              <li key={warning} className="font-mono text-[8px] leading-relaxed text-ink-faint">

                {warning}

              </li>

            ))}

          </ul>

        ) : null}

      </div>



      <div className="space-y-3">

        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faint">Override (optional)</p>

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

              placeholder={PLACEHOLDERS[sourceId] ?? 'Leave blank for automatic discovery'}

              className="w-full rounded border border-panel-border bg-panel-surface px-3 py-2 font-mono text-xs text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/30"

              disabled={disabled}

            />

            {discovered?.urls?.[sourceId]?.url ? (

              <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">

                Preview: {domainLabel(discovered.urls[sourceId].url)} ({discovered.urls[sourceId].confidence})

              </p>

            ) : null}

          </div>

        ))}

      </div>

    </div>

  )

}


