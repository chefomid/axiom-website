import { insuranceSourcesConfigured } from '../../services/propertyApi'

const LOAD_COPE_BTN =
  'mt-4 w-full rounded-md border border-amber-500/55 bg-transparent px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-amber-100 transition hover:border-amber-400/70 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40'

export default function PremiumSourceCallout({
  vendors,
  catalog,
  onApplyPreset,
  locationLocked,
  loadingReport,
}) {
  const attom = vendors?.attom
  const keysConfigured = insuranceSourcesConfigured(catalog)

  if (!attom) return null

  return (
    <div className="border-b border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber-200/90">
        Insurance-grade data
      </p>
      <p className="font-display text-sm leading-snug text-white">
        Carrier-trusted property intelligence
      </p>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-secondary">
        Underwriters recognize <span className="text-amber-100">{attom.name}</span>. Add it to your
        receipt for defensible COPE Construction, Occupancy, and Exposure fields with source
        citations.
      </p>

      <ul className="mt-3 space-y-2">
        <li className="rounded border border-amber-500/20 bg-black/40 px-3 py-2">
          <p className="font-mono text-[10px] font-medium text-amber-100">{attom.name}</p>
          <p className="mt-0.5 font-mono text-[9px] leading-relaxed text-ink-muted">{attom.tagline}</p>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">{attom.credibility}</p>
        </li>
      </ul>

      {!keysConfigured ? (
        <p className="mt-3 font-mono text-[9px] leading-relaxed text-command-watch">
          ATTOM_API_KEY not configured — preset will run free hazards and COPE until the key is added
          to the server.
        </p>
      ) : null}

      {onApplyPreset && locationLocked ? (
        <button
          type="button"
          disabled={loadingReport}
          onClick={() => onApplyPreset('cope_insurance')}
          className={LOAD_COPE_BTN}
        >
          {keysConfigured
            ? 'Load COPE — insurance grade preset'
            : 'Load COPE — free sources from preset'}
        </button>
      ) : onApplyPreset ? (
        <p className="mt-4 font-mono text-[9px] leading-relaxed text-ink-faint">
          Select an address from the list or wait for the map to lock on a location to load the COPE
          preset.
        </p>
      ) : null}
    </div>
  )
}
