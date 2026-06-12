import { useState } from 'react'

import { SEISMIC_ANALYSIS_COUNTRIES } from '../../data/commandMapData'
import { countryCenterLocation, globalCenterLocation } from '../../services/geocode'
import { SegmentButton } from '../ui/CommandControls'
import AddressGeocodeInput from '../ui/AddressGeocodeInput'

function inBbox(lat, lng, bbox) {
  if (!bbox || bbox.length !== 4) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lng >= minLon && lng <= maxLon && lat >= minLat && lat <= maxLat
}

function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  })
}

export default function SeismicLocationPicker({
  countryId,
  onCountryChange,
  addressQuery,
  onAddressChange,
  onLocationSelect,
  mapUserLocation = null,
  disabled = false,
}) {
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  const country =
    SEISMIC_ANALYSIS_COUNTRIES.find(c => c.id === countryId) ?? SEISMIC_ANALYSIS_COUNTRIES[0]

  const applyCoordinates = (lat, lng, sourceLabel) => {
    if (!inBbox(lat, lng, country.bbox)) {
      setLocationError(`That location is outside ${country.label}. Switch country or pick an address in range.`)
      return
    }

    setLocationError('')
    onAddressChange('')
    onLocationSelect({
      lat,
      lng,
      label: `${sourceLabel} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    })
  }

  const handleUseCurrentLocation = async () => {
    if (disabled || locating) return

    if (mapUserLocation) {
      applyCoordinates(mapUserLocation.lat, mapUserLocation.lng, 'Map location')
      return
    }

    setLocating(true)
    setLocationError('')
    try {
      const { lat, lng } = await requestBrowserLocation()
      applyCoordinates(lat, lng, 'Current location')
    } catch {
      setLocationError('Unable to access your location. Allow browser location access and try again.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
      <div>
        <p className="section-label-sm mb-1">
          Step 1
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          {SEISMIC_ANALYSIS_COUNTRIES.map(c => (
            <SegmentButton
              key={c.id}
              className={`!min-h-[34px] !flex-none ${c.id === 'GLOBAL' ? 'px-2.5' : 'px-3'}`}
              active={country.id === c.id}
              disabled={disabled}
              onClick={() => {
                onCountryChange(c.id)
                if (c.id === 'GLOBAL') {
                  onLocationSelect(globalCenterLocation())
                }
              }}
            >
              {c.id === 'GLOBAL' ? 'Global' : c.id}
            </SegmentButton>
          ))}
        </div>
        <p className="font-mono text-[10px] text-ink-faint">
          Selected: <span className="text-white">{country.label}</span>
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          United States Geological Survey
        </p>
      </div>

      <div className="border-t border-[#222] pt-4">
        <p className="section-label-sm mb-2">
          Step 2
        </p>

        {country.id === 'GLOBAL' ? (
          <>
            <p className="font-mono text-[10px] leading-relaxed text-ink-secondary">
              Full USGS worldwide catalog for your magnitude and timeline, every region with
              published earthquake data (US, Mexico, Japan, and all other covered areas).
            </p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
              Up to 20,000 events shown, balanced across the selected time window.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onLocationSelect(globalCenterLocation())}
              className="mt-3 font-mono text-[10px] text-[#ff9348] transition hover:text-[#ffb366] disabled:opacity-40"
            >
              Global analysis, worldwide overview
            </button>
          </>
        ) : (
          <>
        <AddressGeocodeInput
          value={addressQuery}
          onChange={onAddressChange}
          onSelect={onLocationSelect}
          countryId={country.id}
          bbox={country.bbox}
          placeholder={country.addressPlaceholder}
          disabled={disabled}
          label="Street address (optional)"
        />

        <button
          type="button"
          disabled={disabled || locating}
          onClick={handleUseCurrentLocation}
          className="mt-2 w-full rounded-lg border border-[#333] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition hover:border-[#ff9348]/50 hover:bg-[#ff9348]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {locating
            ? 'Locating…'
            : mapUserLocation
              ? 'Use map location'
              : 'Use current location'}
        </button>

        {locationError && (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-command-critical">
            {locationError}
          </p>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => onLocationSelect(countryCenterLocation(country))}
          className="mt-2 font-mono text-[10px] text-[#ff9348] transition hover:text-[#ffb366] disabled:opacity-40"
        >
          {country.id === 'US'
            ? 'National analysis, United States overview'
            : `Skip address, analyze ${country.label} overview`}
        </button>
        {country.id === 'US' && (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-faint">
            US scope uses the full national catalog. Use current location or an address for a local
            radius study.
          </p>
        )}
          </>
        )}
      </div>
    </div>
  )
}
