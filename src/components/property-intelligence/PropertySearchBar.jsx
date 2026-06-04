import { SEISMIC_COUNTRY_BBOX } from '../../data/commandMapData'
import { searchUsPropertyAddresses } from '../../services/geocode'
import AddressGeocodeInput from '../ui/AddressGeocodeInput'

export default function PropertySearchBar({
  address,
  loading,
  resolving = false,
  locationLocked = false,
  onAddressChange,
  onAddressSelect,
  onClear,
}) {
  return (
    <div className="space-y-3 border-b border-panel-border p-4">
      <AddressGeocodeInput
        value={address}
        onChange={onAddressChange}
        onSelect={onAddressSelect}
        countryId="US"
        bbox={SEISMIC_COUNTRY_BBOX.US}
        searchFn={(q, opts) =>
          searchUsPropertyAddresses(q, {
            ...opts,
            countryId: 'US',
            bbox: SEISMIC_COUNTRY_BBOX.US,
          })
        }
        requireCountry={false}
        dropdownInline
        hideDropdown={locationLocked}
        placeholder="123 Main St, Portland, OR 97201"
        disabled={loading}
        label="Property address"
        inputClassName="w-full rounded border border-panel-border bg-panel-surface px-3 py-2.5 font-mono text-[13px] text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/30 disabled:cursor-not-allowed disabled:opacity-40"
        labelClassName="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted"
        dropdownClassName="sleek-scrollbar mt-2 max-h-48 w-full overflow-y-auto rounded border border-panel-border bg-panel-surface py-1 shadow-xl [color-scheme:dark]"
        optionHighlightClassName="bg-command-live/15 text-white"
      />

      {address.trim() && !locationLocked ? (
        <p className="font-mono text-[9px] leading-relaxed text-ink-faint">
          {resolving ? 'Locating…' : 'Press Enter or pause'}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onClear}
        disabled={loading}
        className="rounded border border-panel-border px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-ink-muted transition hover:text-white disabled:opacity-40"
      >
        Clear
      </button>
    </div>
  )
}
