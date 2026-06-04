import { useEffect, useRef, useState } from 'react'
import { fetchPropertyEnvStatus } from '../../services/propertyApi'
import StatusChip from '../better-world/StatusChip'

const KEY_LABELS = {
  ATTOM_API_KEY: 'ATTOM',
  RENTCAST_API_KEY: 'RentCast',
  REGRID_API_KEY: 'Regrid',
  MELISSA_LICENSE_KEY: 'Melissa',
  FIRSTSTREET_API_KEY: 'First Street',
  OPENAI_API_KEY: 'OpenAI',
  CORELOGIC_API_KEY: 'CoreLogic',
}

export default function VendorKeysStatus({ apiOnline }) {
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!apiOnline) {
      setStatus(null)
      return undefined
    }
    let cancelled = false
    fetchPropertyEnvStatus()
      .then(data => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = event => {
      const root = rootRef.current
      if (!root) return
      if (root.contains(event.target)) return
      setOpen(false)
    }

    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, { capture: true })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!apiOnline || !status) return null

  const total = (status.configured?.length ?? 0) + (status.missing?.length ?? 0)
  const configuredCount = status.configured?.length ?? 0
  const allOk = status.all_configured
  const configured = status.configured ?? []
  const missing = status.missing ?? []

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={allOk ? 'All vendor API keys configured' : `Missing: ${missing.join(', ')}`}
      >
        <StatusChip
          label={`Vendor keys ${configuredCount}/${total}`}
          status={allOk ? 'stable' : 'watch'}
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Vendor API keys"
          className="absolute right-0 top-full z-40 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-panel-border bg-panel-bg shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-panel-border/70 bg-panel-surface/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white">
                Vendor API keys
              </p>
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-secondary">
                {allOk ? (
                  <span className="text-command-stable">All configured</span>
                ) : (
                  <span className="text-command-watch">{missing.length} missing</span>
                )}{' '}
                · {configured.length} configured
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-md border border-panel-border bg-panel-bg px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint transition hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              Loaded env files
            </p>
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-secondary">
              {(status.loaded_env_files ?? []).join(', ') || 'none'}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-panel-border/70 bg-panel-surface/30 p-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                  Configured
                </p>
                <ul className="mt-2 max-h-[40vh] space-y-1 overflow-auto pr-1 sleek-scrollbar">
                  {configured.length ? (
                    configured.map(key => (
                      <li key={key} className="font-mono text-[9px] text-command-stable">
                        ✓ {KEY_LABELS[key] ?? key}
                      </li>
                    ))
                  ) : (
                    <li className="font-mono text-[9px] text-ink-faint">None</li>
                  )}
                </ul>
              </div>

              <div className="rounded-md border border-panel-border/70 bg-panel-surface/30 p-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                  Missing
                </p>
                <ul className="mt-2 max-h-[40vh] space-y-1 overflow-auto pr-1 sleek-scrollbar">
                  {missing.length ? (
                    missing.map(key => (
                      <li key={key} className="font-mono text-[9px] text-command-watch">
                        ○ {KEY_LABELS[key] ?? key}
                      </li>
                    ))
                  ) : (
                    <li className="font-mono text-[9px] text-command-stable">✓ None missing</li>
                  )}
                </ul>
              </div>
            </div>

            {!allOk ? (
              <div className="mt-3 rounded-md border border-command-watch/30 bg-command-watch/5 p-2.5">
                <p className="font-mono text-[9px] leading-relaxed text-ink-secondary">
                  Add keys to <code className="text-white">.env.local</code> (repo root) or{' '}
                  <code className="text-white">services/property-api/.env</code>, then restart{' '}
                  <code className="text-white">npm run dev:all</code>.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function VendorKeysInline({ apiOnline, className = '' }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!apiOnline) {
      setStatus(null)
      return undefined
    }
    let cancelled = false
    fetchPropertyEnvStatus()
      .then(data => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [apiOnline])

  if (!apiOnline || !status) return null

  const total = (status.configured?.length ?? 0) + (status.missing?.length ?? 0)
  const configuredCount = status.configured?.length ?? 0
  const allOk = status.all_configured
  const configured = status.configured ?? []
  const missing = status.missing ?? []

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
          Vendor keys
        </p>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[10px] ${allOk ? 'text-command-stable' : 'text-command-watch'}`}>
            {configuredCount}/{total}
          </span>
          <span className="font-mono text-[9px] text-ink-faint">
            {allOk ? 'all configured' : `${missing.length} missing`}
          </span>
        </div>
      </div>

      {!allOk ? (
        <div className="mt-1.5 rounded-md border border-command-watch/30 bg-command-watch/5 px-2.5 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <p className="font-mono text-[9px] text-ink-secondary">
              Missing:
            </p>
            <ul className="flex flex-wrap gap-x-2 gap-y-1">
              {missing.map(key => (
                <li key={key} className="font-mono text-[9px] text-command-watch">
                  {KEY_LABELS[key] ?? key}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-ink-secondary">
            Add keys to <code className="text-white">.env.local</code> (repo root) or{' '}
            <code className="text-white">services/property-api/.env</code>, then restart{' '}
            <code className="text-white">npm run dev:all</code>.
          </p>
          {(status.loaded_env_files ?? []).length ? (
            <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-ink-faint">
              Loaded: {(status.loaded_env_files ?? []).join(', ')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 font-mono text-[9px] text-ink-faint">
          All configured.
        </p>
      )}

      {configured.length ? (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
          {configured.map(key => (
            <span key={key} className="font-mono text-[9px] text-command-stable">
              ✓ {KEY_LABELS[key] ?? key}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
