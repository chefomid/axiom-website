import { useState } from 'react'

function formatImageryUsed(used) {
  if (!Array.isArray(used) || !used.length) return '-'
  return used
    .map(item => {
      if (item === 'satellite') return 'Satellite'
      if (item === 'street') return 'Street View'
      return String(item)
    })
    .join(', ')
}

function SectionHeader({ children }) {
  return (
    <header className="cope-runway__header shrink-0 px-4 py-3">
      <p className="font-display text-sm font-semibold tracking-[0.04em]">
        <span className="cope-runway__label text-[11px] font-medium uppercase tracking-[0.14em]">
          {children}
        </span>
      </p>
    </header>
  )
}

function CollapsibleSection({ title, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
      <button
        type="button"
        onClick={onToggle}
        className="cope-runway__header flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:brightness-110"
      >
        <span className="cope-runway__label font-display text-[11px] font-medium uppercase tracking-[0.14em]">
          {title}
        </span>
        <span className="cope-runway__count font-mono text-sm leading-none">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-panel-border/60 px-4 py-3">{children}</div> : null}
    </section>
  )
}

function MaterialRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 border-b border-panel-border/50 py-2.5 last:border-0 last:pb-0 first:pt-0">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-right font-sans text-sm text-ink-primary">{value}</dd>
    </div>
  )
}

function ImageryCapturesGallery({ captures }) {
  if (!Array.isArray(captures) || captures.length === 0) return null

  return (
    <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
      <SectionHeader>Location screenshots</SectionHeader>
      <div className="border-b border-panel-border/60 px-4 py-3">
        <p className="font-sans text-xs leading-relaxed text-ink-muted">
          Captures used by Property Inspector for this analysis. Highlighted view was selected for
          facade review. Upward pitch scans reveal upper floors when the level view cuts off the roofline.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {captures.map(capture => {
          const headingLabel =
            capture.heading != null ? ` · ${capture.heading}°` : ''
          const pitchLabel =
            capture.pitch != null && capture.pitch !== 0 ? ` · pitch ${capture.pitch}°` : ''
          return (
            <figure
              key={capture.image_id}
              className={`overflow-hidden rounded-md border bg-black/40 ${
                capture.selected
                  ? 'border-command-live/60 ring-1 ring-command-live/30'
                  : 'border-panel-border/70'
              }`}
            >
              {capture.data_url ? (
                <img
                  src={capture.data_url}
                  alt={capture.label || capture.image_id}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <figcaption className="border-t border-panel-border/60 px-3 py-2">
                <p className="font-sans text-xs text-ink-primary">
                  {capture.label || capture.image_id}
                  {capture.selected ? (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-wide text-command-live">
                      Selected
                    </span>
                  ) : null}
                </p>
                {headingLabel || pitchLabel ? (
                  <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                    {headingLabel ? `Heading${headingLabel}` : null}
                    {pitchLabel ? (
                      <span>
                        {headingLabel ? ' ' : ''}
                        Pitch{pitchLabel}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}

export default function ReportVisionPanel({ visionAnalysis }) {
  const [traceOpen, setTraceOpen] = useState(false)

  if (!visionAnalysis) {
    return (
      <p className="p-5 font-sans text-sm text-ink-muted">
        Image analysis was not run for this report.
      </p>
    )
  }

  const {
    summary,
    iso_class: isoClass,
    iso_label: isoLabel,
    evidence = [],
    limitations = [],
    rationale = [],
    imagery_used: imageryUsed,
    facade_material: facadeMaterial,
    roof_material: roofMaterial,
    roof_shape: roofShape,
    stories_visible: storiesVisible,
    floor_levels: floorLevels = [],
    agent_trace: agentTrace,
    subject_description: subjectDescription,
    imagery_captures: imageryCaptures = [],
  } = visionAnalysis

  const phases = agentTrace?.phases || []
  const captures = agentTrace?.captures || []
  const selectedView = agentTrace?.selected_view
  const isoTitle = [isoClass, isoLabel].filter(Boolean).join(', ')
  const hasMaterials = facadeMaterial || roofMaterial || roofShape

  return (
    <div className="space-y-5 p-5">
      <ImageryCapturesGallery captures={imageryCaptures} />

      {isoTitle ? (
        <section className="overflow-hidden rounded-lg border border-panel-border bg-panel-surface/50">
          <SectionHeader>ISO construction estimate</SectionHeader>
          <div className="px-4 py-4">
            <p className="dossier-value font-display text-lg font-semibold leading-tight">{isoTitle}</p>
            {summary ? (
              <p className="mt-3 font-sans text-sm leading-relaxed text-ink-primary">{summary}</p>
            ) : null}
            {subjectDescription ? (
              <p className="mt-2 font-sans text-sm leading-relaxed text-ink-secondary">{subjectDescription}</p>
            ) : null}
          </div>
        </section>
      ) : summary ? (
        <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
          <SectionHeader>Summary</SectionHeader>
          <div className="px-4 py-4">
            <p className="font-sans text-sm leading-relaxed text-ink-primary">{summary}</p>
          </div>
        </section>
      ) : null}

      {(hasMaterials || storiesVisible != null || floorLevels.length > 0) && (
        <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
          <SectionHeader>Building details</SectionHeader>
          <dl className="px-4 py-1">
            <MaterialRow label="Facade" value={facadeMaterial} />
            <MaterialRow label="Roof material" value={roofMaterial} />
            <MaterialRow label="Roof shape" value={roofShape} />
            {storiesVisible != null ? (
              <MaterialRow
                label="Stories"
                value={`${storiesVisible} ${storiesVisible === 1 ? 'story' : 'stories'} visible${
                  floorLevels.length > 0
                    ? ` · ${floorLevels.length} floor band${floorLevels.length === 1 ? '' : 's'}`
                    : ''
                }`}
              />
            ) : null}
          </dl>
          {floorLevels.length > 0 ? (
            <ul className="space-y-2 border-t border-panel-border/60 px-4 py-3">
              {floorLevels.map((item, i) => (
                <li
                  key={`floor-${item.level ?? i}`}
                  className="rounded-md border border-panel-border/70 bg-panel-bg/50 px-3 py-2.5"
                >
                  <p className="font-sans text-sm text-ink-primary">
                    Level {item.level ?? i + 1}: {item.feature}
                  </p>
                  {item.image ? (
                    <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{item.image}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
        <SectionHeader>Imagery used</SectionHeader>
        <div className="px-4 py-4">
          <p className="font-sans text-sm text-ink-primary">{formatImageryUsed(imageryUsed)}</p>
          {selectedView?.heading != null ? (
            <p className="mt-1.5 font-mono text-[10px] text-ink-muted">
              Selected view: {selectedView.id} @ {selectedView.heading}°
              {selectedView.pitch != null && selectedView.pitch !== 0
                ? `, pitch ${selectedView.pitch}°`
                : ''}
            </p>
          ) : null}
        </div>
      </section>

      {evidence.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/30">
          <SectionHeader>Evidence</SectionHeader>
          <ul className="space-y-2.5 px-4 py-3">
            {evidence.map((item, i) => (
              <li
                key={`${item.feature}-${i}`}
                className="rounded-lg border border-panel-border/80 border-l-[3px] border-l-command-live/60 bg-panel-surface/40 px-4 py-3"
              >
                <p className="font-sans text-sm font-medium text-ink-primary">{item.feature}</p>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-muted">
                  {item.image}
                  {item.note ? `, ${item.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rationale.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-panel-border/80 bg-panel-surface/20">
          <SectionHeader>ISO rationale</SectionHeader>
          <ul className="space-y-2 px-4 py-4 font-sans text-sm leading-relaxed text-ink-secondary">
            {rationale.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-command-live/70" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {limitations.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-panel-border/60 bg-panel-bg/40">
          <SectionHeader>Limitations</SectionHeader>
          <ul className="space-y-2 px-4 py-4 font-sans text-sm leading-relaxed text-ink-muted">
            {limitations.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {agentTrace ? (
        <CollapsibleSection title="Agent trace" open={traceOpen} onToggle={() => setTraceOpen(v => !v)}>
          <ul className="space-y-2 font-mono text-[10px] leading-relaxed text-ink-muted">
            {phases.map((phase, i) => (
              <li key={i}>
                <span className="text-ink-secondary">{phase.name}</span>
                {phase.latency_ms != null ? ` (${phase.latency_ms} ms)` : ''}: {phase.detail}
              </li>
            ))}
            {captures.length > 0 ? (
              <li>
                Captures:{' '}
                {captures
                  .map(c => {
                    const pitch =
                      c.pitch != null && c.pitch !== 0 ? ` pitch ${c.pitch}°` : ''
                    return `${c.image_id}@${c.heading}°${pitch}`
                  })
                  .join(', ')}
              </li>
            ) : null}
            {agentTrace.bearing_deg != null ? <li>Bearing to subject: {agentTrace.bearing_deg}°</li> : null}
          </ul>
        </CollapsibleSection>
      ) : null}
    </div>
  )
}
