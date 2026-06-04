import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import {
  ANALYTICS_RADIUS_BREAKPOINTS,
  ANALYTICS_YEAR_PRESETS,
  EARTHQUAKE_MAGNITUDE_OPTIONS,
  NATIONAL_US_MAX_RADIUS_MILES,
  NATIONAL_US_RADIUS_OPTIONS,
  RADIUS_OPTIONS,
} from '../../data/commandMapData'
import {
  detectCountryIdForCoords,
  REPORT_ABOUT_OPTIONS,
  REPORT_DEPTH_PRESETS,
  resolveReportSections,
  resolveReportScope,
  sectionsForScope,
  isSectionAvailable,
  SEISMIC_COUNTRIES_FOR_REPORT,
} from '../../utils/earthquakeReport'
import { GhostButton, PrimaryButton, SegmentButton, ToggleChip } from '../ui/CommandControls'
import AddressGeocodeInput from '../ui/AddressGeocodeInput'
import { DIGEST_ANALYSIS_TYPES } from './EarthquakeStatDigestPanel'

function isAddressCenter(center) {
  if (!center?.label) return false
  return !center.label.includes('(overview)') && !center.label.startsWith('Global (')
}

function inferInitialAboutType({ analysisCountryId, currentCenterOverride, globalAnalysis, countryOverview }) {
  if (globalAnalysis || analysisCountryId === 'GLOBAL') return 'global'
  if (isAddressCenter(currentCenterOverride)) return 'address'
  if (countryOverview) return 'country'
  if (currentCenterOverride?.label?.includes('Current location') || currentCenterOverride?.label?.includes('Map location')) {
    return 'current-location'
  }
  return 'country'
}

function radiusOptionsForAbout(aboutType) {
  if (aboutType === 'global') return []
  if (aboutType === 'country') return NATIONAL_US_RADIUS_OPTIONS
  return RADIUS_OPTIONS.filter(miles => ANALYTICS_RADIUS_BREAKPOINTS.includes(miles))
}

function defaultRadiusForAbout(aboutType, currentRadius) {
  if (aboutType === 'global') return currentRadius
  if (aboutType === 'country') {
    return NATIONAL_US_RADIUS_OPTIONS.includes(currentRadius)
      ? currentRadius
      : NATIONAL_US_MAX_RADIUS_MILES
  }
  return RADIUS_OPTIONS.includes(currentRadius) ? currentRadius : 250
}

export default function EarthquakeReportBuilderModal({
  open,
  onClose,
  onGenerate,
  analysisCountryId,
  currentCenterOverride,
  mapUserLocation,
  initialYearPresetId,
  initialMinMagnitude,
  initialRadiusMiles,
  globalAnalysis,
  countryOverview,
}) {
  const [aboutType, setAboutType] = useState('country')
  const [countryId, setCountryId] = useState('US')
  const [yearPresetId, setYearPresetId] = useState('5y')
  const [minMagnitude, setMinMagnitude] = useState(2.5)
  const [radiusMiles, setRadiusMiles] = useState(250)
  const [depthId, setDepthId] = useState('standard')
  const [sectionOverrides, setSectionOverrides] = useState(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressCenter, setAddressCenter] = useState(null)
  const [focusError, setFocusError] = useState('')

  const country =
    SEISMIC_COUNTRIES_FOR_REPORT.find(c => c.id === countryId) ?? SEISMIC_COUNTRIES_FOR_REPORT[0]

  const radiusOptions = useMemo(() => radiusOptionsForAbout(aboutType), [aboutType])

  useEffect(() => {
    if (!open) return
    const inferredAbout = inferInitialAboutType({
      analysisCountryId,
      currentCenterOverride,
      globalAnalysis,
      countryOverview,
    })
    setAboutType(inferredAbout)
    setCountryId(
      analysisCountryId && analysisCountryId !== 'GLOBAL'
        ? analysisCountryId
        : 'US',
    )
    setYearPresetId(initialYearPresetId ?? '5y')
    setMinMagnitude(initialMinMagnitude ?? 2.5)
    setRadiusMiles(defaultRadiusForAbout(inferredAbout, initialRadiusMiles ?? 250))
    setDepthId('standard')
    setSectionOverrides(null)
    setFocusError('')

    if (isAddressCenter(currentCenterOverride)) {
      setAddressQuery(currentCenterOverride.label ?? '')
      setAddressCenter(currentCenterOverride)
    } else {
      setAddressQuery('')
      setAddressCenter(null)
    }
  }, [
    open,
    analysisCountryId,
    globalAnalysis,
    countryOverview,
    initialYearPresetId,
    initialMinMagnitude,
    initialRadiusMiles,
    currentCenterOverride?.lat,
    currentCenterOverride?.lng,
    currentCenterOverride?.label,
  ])

  useEffect(() => {
    if (!radiusOptions.length) return
    if (!radiusOptions.includes(radiusMiles)) {
      setRadiusMiles(radiusOptions[radiusOptions.length - 1])
    }
  }, [radiusOptions, radiusMiles])

  const previewHasTemporal = aboutType !== 'global'
  const previewScope = resolveReportScope({
    focusId: aboutType,
    globalAnalysis: aboutType === 'global',
    countryOverview: aboutType === 'country',
  })

  const presetSections = useMemo(
    () => resolveReportSections(depthId, { scope: previewScope, hasTemporalAnalytics: previewHasTemporal }),
    [depthId, previewScope, previewHasTemporal],
  )

  const activeSections = sectionOverrides ?? presetSections

  const selectableSections = useMemo(
    () =>
      sectionsForScope(previewScope).filter(id =>
        isSectionAvailable(id, { scope: previewScope, hasTemporalAnalytics: previewHasTemporal }),
      ),
    [previewScope, previewHasTemporal],
  )

  const filterPreview = useMemo(() => {
    const yearLabel = ANALYTICS_YEAR_PRESETS.find(p => p.id === yearPresetId)?.label ?? yearPresetId
    const magLabel = EARTHQUAKE_MAGNITUDE_OPTIONS.find(o => o.value === minMagnitude)?.label ?? `M${minMagnitude}+`
    if (aboutType === 'global') return `${yearLabel} · ${magLabel}`
    return `${yearLabel} · ${radiusMiles} mi · ${magLabel}`
  }, [aboutType, yearPresetId, radiusMiles, minMagnitude])

  const toggleSection = id => {
    setSectionOverrides(prev => {
      const base = prev ?? presetSections
      if (base.includes(id)) return base.filter(s => s !== id)
      return [...base, id]
    })
  }

  const handleAboutChange = nextType => {
    setAboutType(nextType)
    setFocusError('')
    setSectionOverrides(null)
    setRadiusMiles(prev => defaultRadiusForAbout(nextType, prev))
  }

  const handleGenerate = () => {
    setFocusError('')

    if (aboutType === 'address' && !addressCenter?.lat) {
      setFocusError('Select an address from search results.')
      return
    }

    const depthPreset = REPORT_DEPTH_PRESETS.find(p => p.id === depthId) ?? REPORT_DEPTH_PRESETS[1]

    onGenerate({
      aboutType,
      countryId: aboutType === 'country' || aboutType === 'address' ? countryId : undefined,
      addressCenter: aboutType === 'address' ? addressCenter : null,
      yearPresetId,
      minMagnitude,
      radiusMiles,
      depthId,
      sectionIds: activeSections,
      includeCharts: depthPreset.includeCharts,
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="eq-report-no-print flex max-h-[min(92vh,860px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#333] bg-[#0d0d0d]/98 shadow-2xl"
            role="dialog"
            aria-labelledby="eq-report-builder-title"
          >
            <div className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
              <p className="section-label-sm tracking-[0.22em]">Seismic report</p>
              <h2
                id="eq-report-builder-title"
                className="font-display mt-1 text-lg font-semibold text-white"
              >
                Build your report
              </h2>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-secondary">
                Pick one subject for the report, set catalog filters, then choose depth.
              </p>
              <p className="mt-2 font-mono text-[10px] text-[#ff9348]">{filterPreview}</p>

              <div className="mt-5">
                <p className="section-label mb-2">Report about</p>
                <div className="space-y-2">
                  {REPORT_ABOUT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleAboutChange(opt.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        aboutType === opt.id
                          ? 'border-[#ff9348]/45 bg-[#ff9348]/10'
                          : 'border-[#2a2a2a] bg-[#111] hover:border-[#444]'
                      }`}
                    >
                      <p className="font-mono text-[11px] text-white">{opt.label}</p>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-faint">
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>

                {aboutType === 'country' ? (
                  <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                    <p className="section-label-sm mb-2">Which country?</p>
                    <div className="flex flex-wrap gap-2">
                      {SEISMIC_COUNTRIES_FOR_REPORT.map(c => (
                        <SegmentButton
                          key={c.id}
                          className="!min-h-[34px] !flex-none px-3"
                          active={countryId === c.id}
                          onClick={() => setCountryId(c.id)}
                        >
                          {c.id}
                        </SegmentButton>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-ink-faint">
                      {country.label} national overview
                    </p>
                  </div>
                ) : null}

                {aboutType === 'address' ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                    <div>
                      <p className="section-label-sm mb-2">Address country</p>
                      <div className="flex flex-wrap gap-2">
                        {SEISMIC_COUNTRIES_FOR_REPORT.map(c => (
                          <SegmentButton
                            key={c.id}
                            className="!min-h-[34px] !flex-none px-3"
                            active={countryId === c.id}
                            onClick={() => {
                              setCountryId(c.id)
                              setAddressCenter(null)
                              setAddressQuery('')
                            }}
                          >
                            {c.id}
                          </SegmentButton>
                        ))}
                      </div>
                    </div>
                    <AddressGeocodeInput
                      value={addressQuery}
                      onChange={setAddressQuery}
                      onSelect={loc => {
                        setAddressCenter(loc)
                        setFocusError('')
                      }}
                      countryId={countryId}
                      bbox={country.bbox}
                      placeholder={country.addressPlaceholder}
                      label="Street address"
                    />
                    {addressCenter ? (
                      <p className="font-mono text-[10px] text-ink-secondary">
                        Selected: <span className="text-white">{addressCenter.label}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {aboutType === 'current-location' ? (
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint">
                    {mapUserLocation
                      ? 'Uses your map scope location. Analysis country is detected from coordinates.'
                      : 'Your browser will request location permission when you generate the report.'}
                    {mapUserLocation
                      ? ` (${detectCountryIdForCoords(mapUserLocation.lat, mapUserLocation.lng)} catalog)`
                      : null}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 border-t border-[#222] pt-5">
                <p className="section-label mb-2">Catalog filters</p>

                <p className="section-label-sm mb-2">Timeline</p>
                <div className="flex flex-wrap gap-2">
                  {ANALYTICS_YEAR_PRESETS.map(preset => (
                    <SegmentButton
                      key={preset.id}
                      className="!min-h-[34px] !flex-none px-4"
                      active={yearPresetId === preset.id}
                      onClick={() => setYearPresetId(preset.id)}
                    >
                      {preset.label}
                    </SegmentButton>
                  ))}
                </div>

                {radiusOptions.length > 0 ? (
                  <>
                    <p className="section-label-sm mb-2 mt-4">Max search radius</p>
                    <div className="flex flex-wrap gap-2">
                      {radiusOptions.map(miles => (
                        <SegmentButton
                          key={miles}
                          className="!min-h-[34px] !flex-none px-3"
                          active={radiusMiles === miles}
                          onClick={() => setRadiusMiles(miles)}
                        >
                          {miles} mi
                        </SegmentButton>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
                      {aboutType === 'country'
                        ? 'National catalog — bands radiate from the country center.'
                        : 'Only earthquakes within this radius of the focus point.'}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-faint">
                    Global reports use the worldwide catalog — no radius filter.
                  </p>
                )}

                <p className="section-label-sm mb-2 mt-4">Minimum magnitude</p>
                <div className="flex flex-wrap gap-2">
                  {EARTHQUAKE_MAGNITUDE_OPTIONS.map(opt => (
                    <ToggleChip
                      key={opt.value}
                      active={minMagnitude === opt.value}
                      layerColor={opt.color}
                      labelClassName={opt.labelClassName}
                      title={opt.description}
                      onClick={() => setMinMagnitude(opt.value)}
                    >
                      {opt.label}
                    </ToggleChip>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-[#222] pt-5">
                <p className="section-label mb-2">Report depth</p>
                <div className="space-y-2">
                  {REPORT_DEPTH_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setDepthId(preset.id)
                        setSectionOverrides(null)
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                        depthId === preset.id
                          ? 'border-[#ff9348]/45 bg-[#ff9348]/10'
                          : 'border-[#2a2a2a] bg-[#111] hover:border-[#444]'
                      }`}
                    >
                      <p className="font-mono text-[11px] text-white">{preset.label}</p>
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-faint">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {depthId !== 'quick' && selectableSections.length > 0 ? (
                <div className="mt-5">
                  <p className="section-label mb-2">Include sections</p>
                  <div className="space-y-1.5">
                    {DIGEST_ANALYSIS_TYPES.filter(t => selectableSections.includes(t.id)).map(type => {
                      const checked = activeSections.includes(type.id)
                      return (
                        <label
                          key={type.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
                            checked
                              ? 'border-[#ff9348]/35 bg-[#ff9348]/8'
                              : 'border-[#2a2a2a] bg-[#0d0d0d]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-[#ff9348]"
                            checked={checked}
                            onChange={() => toggleSection(type.id)}
                          />
                          <span className="min-w-0">
                            <span className="block font-mono text-[10px] text-white">{type.label}</span>
                            <span className="mt-0.5 block font-mono text-[9px] leading-relaxed text-ink-faint">
                              {type.description}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {focusError ? (
                <p className="mt-4 font-mono text-[10px] leading-relaxed text-command-critical">
                  {focusError}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#222] px-5 py-4">
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <PrimaryButton onClick={handleGenerate}>View report</PrimaryButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
