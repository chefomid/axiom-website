import { SEISMIC_COUNTRY_BBOX } from '../../data/commandMapData'
import { isPropertyAddressQuery, searchUsAddressSuggestions } from '../../services/geocode'
import AddressGeocodeInput from '../ui/AddressGeocodeInput'
import { WORKFLOW_CTL, WORKFLOW_CTL_NEUTRAL, WORKFLOW_INPUT, WORKFLOW_SECTION_LABEL } from './workflowControls'

/** Stable reference so AddressGeocodeInput does not restart search on parent re-render. */
function searchPropertyAddressSuggestions(q, opts) {
  return searchUsAddressSuggestions(q, {
    ...opts,
    countryId: 'US',
    bbox: SEISMIC_COUNTRY_BBOX.US,
  })
}

const PHASE_COPY = {
  idle: '',
  composing: 'Pick a suggestion or press Enter to lock the property on the map',
  searching: 'Searching addresses…',
  locating: 'Finding your location…',
  resolving: 'Please wait: Placing property on the map…',
  locked: 'Select a package',
  error: '',
}

const STEPS = [
  { id: 'type', label: 'Type' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'locked', label: 'Locked' },
]

function stepIndex(phase) {
  if (phase === 'locked') return 2
  if (phase === 'resolving' || phase === 'locating') return 1
  if (phase === 'composing' || phase === 'searching') return 0
  if (phase === 'idle') return -1
  return 0
}

function LocationIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2.5c-2.9 0-5.25 2.35-5.25 5.25 0 3.95 5.25 9.75 5.25 9.75s5.25-5.8 5.25-9.75C15.25 4.85 12.9 2.5 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="7.75" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m5.5 10.5 3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PropertySearchBar({
  address,
  loading,
  locationLocked = false,
  locationPhase = 'idle',
  locationError = '',
  onAddressChange,
  onAddressSelect,
  onMyLocation,
  onClear,
  onSearchingChange,
  locateSuccess = false,
  geolocateCommitting = false,
  compact = false,
}) {
  const activeStep = stepIndex(locationPhase)
  const statusText = locationError || PHASE_COPY[locationPhase] || ''
  const isLocating = locationPhase === 'locating'
  const isLocked = locationPhase === 'locked'
  const suppressDropdown =
    locationLocked || geolocateCommitting || locationPhase === 'locating' || locationPhase === 'resolving'

  const lockedCompact = compact && (locationLocked || isLocked)

  return (
    <div
      className={`flex flex-col ${
        compact
          ? lockedCompact
            ? 'gap-2'
            : 'gap-3.5'
          : 'h-full min-h-0 justify-center gap-3'
      }`}
    >
      <AddressGeocodeInput
        value={address}
        onChange={onAddressChange}
        onSelect={onAddressSelect}
        countryId="US"
        bbox={SEISMIC_COUNTRY_BBOX.US}
        searchFn={searchPropertyAddressSuggestions}
        searchDebounceMs={350}
        minSearchLength={5}
        isQuerySearchable={isPropertyAddressQuery}
        requireCountry={false}
        variant="default"
        dropdownInline={compact}
        dropdownClassName="sleek-scrollbar mt-1 max-h-56 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]"
        showClearButton
        onClear={onClear}
        onSearchingChange={onSearchingChange}
        confirmBeforeSelect
        placeholder="123 Main St, Portland, OR 97201"
        disabled={loading || isLocating}
        label="Street address"
        labelClassName={WORKFLOW_SECTION_LABEL}
        inputClassName={WORKFLOW_INPUT}
        hideDropdown={suppressDropdown}
        committedLabel={suppressDropdown && address ? address : undefined}
      />

      {!compact ? (
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const done = activeStep > index
          const active = activeStep === index
          return (
            <div key={step.id} className="flex items-center gap-2">
              {index > 0 ? (
                <span
                  className={`h-px w-6 ${done || active ? 'bg-command-live/40' : 'bg-panel-border'}`}
                  aria-hidden
                />
              ) : null}
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] font-medium transition ${
                    done
                      ? 'bg-command-watch/20 text-command-watch'
                      : active
                        ? 'bg-command-live/20 text-command-live ring-1 ring-command-live/40'
                        : 'bg-panel-surface text-ink-faint'
                  }`}
                >
                  {done ? <CheckIcon className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={`font-mono text-[9px] uppercase tracking-wider ${
                    active ? 'text-white' : done ? 'text-ink-secondary' : 'text-ink-faint'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      ) : null}

      {statusText ? (
        <div className={`flex flex-col ${lockedCompact ? 'gap-0.5' : 'gap-1'} ${compact ? 'text-left' : 'items-center text-center'}`}>
          <p
            className={`font-mono leading-snug ${
              lockedCompact ? 'text-[9px]' : 'text-[10px] leading-relaxed'
            } ${
              locationError
                ? 'text-command-critical'
                : isLocked || locateSuccess
                  ? 'text-command-watch'
                  : locationPhase === 'resolving'
                    ? 'text-command-watch'
                    : locationPhase === 'composing' || locationPhase === 'searching'
                      ? 'text-command-live'
                      : 'text-ink-muted'
            }`}
          >
            {statusText}
          </p>
        </div>
      ) : null}

      {locationError && !locationLocked ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onMyLocation}
            className="font-mono text-[10px] uppercase tracking-wider text-command-live underline-offset-2 hover:underline"
          >
            Try using my location instead
          </button>
        </div>
      ) : null}

      {!locationLocked && !isLocked ? (
        <div>
          <button
            type="button"
            onClick={onMyLocation}
            disabled={loading || isLocating}
            className={`${WORKFLOW_CTL} w-full ${WORKFLOW_CTL_NEUTRAL} ${
              isLocating ? 'pi-locate-pulse border-command-live/40 text-command-live' : ''
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {isLocating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-command-live/30 border-t-command-live" aria-hidden />
            ) : locateSuccess ? (
              <CheckIcon className="h-3.5 w-3.5 text-command-watch" />
            ) : (
              <LocationIcon className="h-3.5 w-3.5" />
            )}
            {isLocating ? 'Finding you…' : locateSuccess ? 'Location found' : 'Use my location'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
