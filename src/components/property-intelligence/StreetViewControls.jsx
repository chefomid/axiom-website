import {
  STREET_HEADINGS,
  STREET_HEADING_LABELS,
  STREET_HEADING_STEP,
  STREET_PITCH_STEP,
  STREET_FOV_STEP,
  clampFov,
  clampPitch,
  normalizeHeading,
  stepHeading,
} from '../../services/propertyImagery'

function ControlButton({ children, active, title, onClick, className = '' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`street-view-ctrl-btn ${active ? 'street-view-ctrl-btn--active' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

function PadSpacer() {
  return <span className="h-8 w-8" aria-hidden />
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronUp() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path d="M3 10 8 5l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconFullscreen() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconExitFullscreen() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ToolbarDivider() {
  return <span className="mx-1 h-16 w-px shrink-0 self-center bg-white/10" aria-hidden />
}

export default function StreetViewControls({
  heading,
  pitch,
  onHeadingChange,
  onPitchChange,
  onFovChange,
  onFullscreen,
  isFullscreen,
  mapsUrl,
}) {
  const bearing = normalizeHeading(heading)
  const headingLabel = STREET_HEADING_LABELS[bearing] ?? `${bearing}°`

  return (
    <div className="street-view-chrome pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3">
      <p className="street-view-hint pointer-events-none mx-auto hidden max-w-md rounded-md border border-white/10 bg-black/90 px-3 py-1.5 text-center font-mono text-[8px] uppercase tracking-[0.18em] text-white shadow-[0_4px_24px_rgba(0,0,0,0.65)] backdrop-blur-sm sm:block">
        Drag in the view to look around · Compass snaps bearing
      </p>

      <div className="pointer-events-auto mx-auto w-full max-w-xl">
        <div className="street-view-toolbar flex items-center justify-center gap-2 rounded-md border border-panel-border bg-black/90 px-2.5 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.75)] backdrop-blur-sm">
          {/* Look D-pad: chevrons in NESW positions */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink-muted">Look</span>
              <span className="font-mono text-[8px] tabular-nums text-command-live">{headingLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-0.5" role="group" aria-label="Look pad">
              <PadSpacer />
              <ControlButton
                title="Tilt up"
                onClick={() => onPitchChange(p => clampPitch(p + STREET_PITCH_STEP))}
              >
                <IconChevronUp />
              </ControlButton>
              <PadSpacer />

              <ControlButton
                title={`Rotate left ${STREET_HEADING_STEP}°`}
                onClick={() => onHeadingChange(stepHeading(heading, -STREET_HEADING_STEP))}
              >
                <IconChevronLeft />
              </ControlButton>
              <span className="street-view-ctrl-btn street-view-ctrl-btn--center pointer-events-none flex items-center justify-center font-mono text-[8px] tabular-nums text-ink-faint">
                {pitch}°
              </span>
              <ControlButton
                title={`Rotate right ${STREET_HEADING_STEP}°`}
                onClick={() => onHeadingChange(stepHeading(heading, STREET_HEADING_STEP))}
              >
                <IconChevronRight />
              </ControlButton>

              <PadSpacer />
              <ControlButton
                title="Tilt down"
                onClick={() => onPitchChange(p => clampPitch(p - STREET_PITCH_STEP))}
              >
                <IconChevronDown />
              </ControlButton>
              <PadSpacer />
            </div>
          </div>

          <ToolbarDivider />

          {/* Compass D-pad: N E S W */}
          <div className="flex flex-col gap-1">
            <span className="px-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-muted">Compass</span>
            <div className="grid grid-cols-3 gap-0.5" role="group" aria-label="Compass">
              <PadSpacer />
              <ControlButton
                active={bearing === 0}
                title="Face north"
                onClick={() => onHeadingChange(0)}
              >
                N
              </ControlButton>
              <PadSpacer />

              <ControlButton
                active={bearing === 270}
                title="Face west"
                onClick={() => onHeadingChange(270)}
              >
                W
              </ControlButton>
              <PadSpacer />
              <ControlButton
                active={bearing === 90}
                title="Face east"
                onClick={() => onHeadingChange(90)}
              >
                E
              </ControlButton>

              <PadSpacer />
              <ControlButton
                active={bearing === 180}
                title="Face south"
                onClick={() => onHeadingChange(180)}
              >
                S
              </ControlButton>
              <PadSpacer />
            </div>
          </div>

          <ToolbarDivider />

          {/* Zoom + utility stack */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <ControlButton
                title="Zoom in"
                onClick={() => onFovChange(v => clampFov(v - STREET_FOV_STEP))}
              >
                <span className="font-mono text-[10px] leading-none">+</span>
              </ControlButton>
              <ControlButton
                title="Zoom out"
                onClick={() => onFovChange(v => clampFov(v + STREET_FOV_STEP))}
              >
                <span className="font-mono text-[10px] leading-none">−</span>
              </ControlButton>
            </div>
            <ControlButton
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={onFullscreen}
            >
              {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
            </ControlButton>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="street-view-ctrl-btn street-view-ctrl-btn--link"
                title="Open in Google Maps"
              >
                <span className="font-mono text-[8px] uppercase tracking-wider">Maps</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none flex justify-center gap-1">
        {STREET_HEADINGS.map(h => (
          <span
            key={h}
            className={`h-1 w-1 rounded-full ${
              bearing === h ? 'bg-command-live' : 'bg-panel-border'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
