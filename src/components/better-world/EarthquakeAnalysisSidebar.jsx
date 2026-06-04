import { SegmentButton, ToggleChip } from '../ui/CommandControls'
import SeismicLocationPicker from './SeismicLocationPicker'

export default function EarthquakeAnalysisSidebar({
  onClose,
  onOpenReport,
  headerTitle,
  headerMeta,
  locationProps,
  timelineProps,
  distanceProps,
  magnitudeProps,
  alerts,
}) {
  return (
    <aside className="sleek-scrollbar flex h-full w-[min(100%,320px)] shrink-0 flex-col border-r border-[#222] bg-[#0a0a0a]">
      <div className="border-b border-[#222] px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">
          Seismic analysis
        </p>
        <h2 className="font-display mt-1 text-lg font-semibold leading-snug text-white">
          {headerTitle}
        </h2>
        {headerMeta ? (
          <p
            className="eq-sidebar-meta mt-2 overflow-x-auto font-mono text-[10px] leading-none text-[#a3a3a3] whitespace-nowrap"
            title={headerMeta}
          >
            {headerMeta}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section>
          <p className="section-label mb-3">
            Location
          </p>
          <SeismicLocationPicker {...locationProps} />
        </section>

        <section className="border-t border-[#222] pt-6">
          <p className="section-label mb-2">
            Timeline
          </p>
          <div className="flex flex-wrap gap-2">
            {timelineProps.presets.map(preset => (
              <SegmentButton
                key={preset.id}
                className="!min-h-[36px] !flex-none px-4"
                active={timelineProps.activeId === preset.id}
                disabled={timelineProps.disabled}
                onClick={() => timelineProps.onChange(preset.id)}
              >
                {preset.label}
              </SegmentButton>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
            USGS catalog window for the frequency map and charts.
          </p>
        </section>

        <section className="border-t border-[#222] pt-6">
          <p className="section-label mb-2">
            Max search radius
          </p>
          {distanceProps.isGlobal ? (
            <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
              Global catalog — all earthquakes worldwide matching your filters. Select a country for
              radius-based analysis.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {distanceProps.options.map(miles => (
                  <SegmentButton
                    key={miles}
                    className="!min-h-[36px] !flex-none px-3"
                    active={distanceProps.activeMiles === miles}
                    onClick={() => distanceProps.onChange(miles)}
                  >
                    {miles} mi
                  </SegmentButton>
                ))}
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
                {distanceProps.isNational
                  ? 'National US catalog — bands radiate from the geographic center of the United States.'
                  : 'Only earthquakes within this radius of the center are shown and analyzed.'}
              </p>
            </>
          )}
        </section>

        <section className="border-t border-[#222] pt-6">
          <p className="section-label mb-2">
            Minimum magnitude
          </p>
          <div className="flex flex-wrap gap-2">
            {magnitudeProps.options.map(opt => (
              <ToggleChip
                key={opt.value}
                active={magnitudeProps.activeValue === opt.value}
                accent="cyber"
                disabled={magnitudeProps.disabled}
                onClick={() => magnitudeProps.onChange(opt.value)}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </section>

        <section className="border-t border-[#222] pt-6">
          <p className="section-label mb-2">Report</p>
          <p className="mb-3 font-mono text-[10px] leading-relaxed text-ink-faint">
            Build a readable seismic activity report from your current filters.
          </p>
          <button
            type="button"
            onClick={onOpenReport}
            className="w-full rounded-lg border border-[#ff9348]/40 bg-[#ff9348]/10 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff9348] transition hover:border-[#ff9348]/60 hover:bg-[#ff9348]/15"
          >
            Generate Report
          </button>
        </section>

        {alerts?.length > 0 && (
          <section className="space-y-2 border-t border-[#222] pt-6">
            {alerts}
          </section>
        )}
      </div>

      <div className="border-t border-[#222] px-4 py-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint transition hover:text-white"
        >
          Back to map
        </button>
      </div>
    </aside>
  )
}
