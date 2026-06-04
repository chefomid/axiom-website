const ACCENT = {
  cyber: {
    active:
      'border-command-cyber/50 bg-command-cyber/12 text-command-cyber ring-1 ring-command-cyber/25',
    dot: 'bg-command-cyber shadow-[0_0_6px_rgba(61,214,140,0.5)]',
    switch: 'bg-command-cyber/35',
  },
  live: {
    active:
      'border-command-live/50 bg-command-live/12 text-white ring-1 ring-command-live/25 shadow-[0_0_14px_rgba(74,158,255,0.12)]',
    dot: 'bg-command-live shadow-[0_0_6px_rgba(74,158,255,0.45)]',
    switch: 'bg-command-live/35',
  },
  stable: {
    active:
      'border-command-stable/50 bg-command-stable/12 text-command-stable ring-1 ring-command-stable/25',
    dot: 'bg-command-stable shadow-[0_0_6px_rgba(61,214,140,0.45)]',
    switch: 'bg-command-stable/35',
  },
}

/** Pill toggle chip — layers, sources, magnitude filters */
export function ToggleChip({
  active,
  onClick,
  children,
  loading = false,
  disabled = false,
  accent = 'cyber',
  layerColor,
  showDot = true,
  iconSrc,
  iconAlt = '',
  title,
}) {
  const a = ACCENT[accent] ?? ACCENT.cyber
  const useLayerColor = Boolean(layerColor)

  const neutralChip = active
    ? 'border-[#4a4a4a] bg-[#141414] text-white ring-1 ring-white/10'
    : 'border-[#383838] bg-[#0e0e0e]/80 text-ink-faint hover:border-[#555] hover:bg-[#141414] hover:text-white'

  const dotStyle = useLayerColor
    ? {
        backgroundColor: layerColor,
        opacity: active ? 1 : 0.55,
        boxShadow: active ? `0 0 5px ${layerColor}99` : undefined,
      }
    : undefined

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={`inline-flex min-h-[34px] max-w-full items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-[11px] tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        useLayerColor ? neutralChip : active ? a.active : neutralChip
      } ${loading ? 'opacity-90' : ''}`}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt={iconAlt}
          aria-hidden={iconAlt ? undefined : true}
          className={`h-4 w-4 shrink-0 rounded-sm object-contain transition-opacity ${
            active ? 'opacity-100' : 'opacity-55'
          } ${loading ? 'animate-pulse' : ''}`}
        />
      ) : (
        showDot && (
          <span
            style={dotStyle}
            className={`h-2 w-2 shrink-0 rounded-full transition-all ${
              useLayerColor
                ? loading
                  ? 'animate-pulse'
                  : ''
                : active
                  ? a.dot
                  : loading
                    ? 'animate-pulse bg-command-watch'
                    : 'bg-[#555]'
            }`}
            aria-hidden
          />
        )
      )}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

/** Minimal iOS-style switch indicator (decorative; parent button handles click) */
export function ToggleSwitch({ active, accent = 'cyber', className = '' }) {
  const a = ACCENT[accent] ?? ACCENT.cyber

  return (
    <span
      className={`relative inline-flex h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200 ${
        active ? a.switch : 'bg-[#2a2a2a]'
      } ${className}`}
      aria-hidden
    >
      <span
        className={`absolute top-[3px] left-[3px] h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          active ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </span>
  )
}

/** Map dock tab — Layers, Sources, Pin, Mag */
export function DockTab({ active, onClick, children, accent = 'cyber' }) {
  const activeClass =
    accent === 'live'
      ? 'bg-white/[0.06] text-command-live ring-1 ring-command-live/25'
      : 'bg-white/[0.06] text-command-cyber ring-1 ring-command-cyber/20'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-200 ${
        active ? activeClass : 'text-ink-muted hover:bg-white/[0.03] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** Compact text actions — All, Clear, Cancel */
export function TextAction({ onClick, children, highlight = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-all duration-200 disabled:opacity-40 ${
        highlight
          ? 'border-command-cyber/30 text-command-cyber hover:border-command-cyber/50 hover:bg-command-cyber/8'
          : 'border-[#333] text-ink-faint hover:border-[#555] hover:bg-white/[0.03] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** Side-panel row toggle with switch */
export function PanelToggle({ active, onClick, label, meta, accent = 'live', iconSrc, iconAlt = '' }) {
  const borderAccent =
    accent === 'stable' ? 'border-command-stable' : accent === 'cyber' ? 'border-command-cyber' : 'border-command-live'
  const textAccent =
    accent === 'stable' ? 'text-command-stable' : accent === 'cyber' ? 'text-command-cyber' : 'text-command-live'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200 ${
        active
          ? `border-l-2 ${borderAccent} bg-white/[0.05]`
          : 'border-l-2 border-transparent hover:bg-white/[0.02]'
      }`}
    >
      {iconSrc && (
        <img
          src={iconSrc}
          alt={iconAlt}
          aria-hidden={iconAlt ? undefined : true}
          className={`h-5 w-5 shrink-0 rounded-sm object-contain transition-opacity ${
            active ? 'opacity-100' : 'opacity-55 group-hover:opacity-75'
          }`}
        />
      )}
      <div className="min-w-0 flex-1">
        <span className={`block font-mono text-[12px] ${active ? 'text-white' : 'text-ink-faint group-hover:text-ink-secondary'}`}>
          {label}
        </span>
        {meta && (
          <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-ink-faint">{meta}</span>
        )}
      </div>
      <span className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] ${active ? textAccent : 'text-ink-faint'}`}>
        {active ? 'On' : 'Off'}
      </span>
      <ToggleSwitch active={active} accent={accent} />
    </button>
  )
}

/** Segmented control option — scope modes, radius */
export function SegmentButton({ active, onClick, children, className = '', loading = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[40px] flex-1 rounded-lg border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-200 disabled:cursor-wait disabled:opacity-70 ${
        active
          ? 'border-command-live/50 bg-command-live/10 text-white ring-1 ring-command-live/20'
          : 'border-[#2e2e2e] bg-[#0c0c0c] text-ink-faint hover:border-[#444] hover:text-white'
      } ${className}`}
    >
      {children}
      {loading ? <span className="ml-1 text-command-watch">…</span> : null}
    </button>
  )
}

/** Scope control pill on map */
export function ScopePill({ onClick, label, value }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-[#2e2e2e] bg-[#0a0a0a]/94 px-4 py-2.5 text-left backdrop-blur-md transition-all duration-200 hover:border-command-cyber/40 hover:bg-[#0e0e0e]/95"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted group-hover:text-ink-secondary">
        {label}
      </p>
      <p className="mt-1 font-mono text-[12px] leading-snug text-white">{value}</p>
    </button>
  )
}

/** Primary modal / form action */
export function PrimaryButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[40px] rounded-lg border border-[#4a4a4a] bg-[#181818] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-all duration-200 hover:border-command-live/60 hover:bg-[#1e1e1e] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Ghost / secondary action */
export function GhostButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[40px] rounded-lg border border-transparent px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-all duration-200 hover:border-[#333] hover:bg-white/[0.03] hover:text-white disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Icon-style dismiss */
export function IconButton({ onClick, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-md border border-[#333] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-all duration-200 hover:border-[#555] hover:bg-white/[0.04] hover:text-white"
    >
      {children}
    </button>
  )
}
