import { useEffect, useId, useRef, useState } from 'react'

import { isSearchableAddressQuery, searchAddresses } from '../../services/geocode'
import { normalizeSuggestion } from '../../utils/coords'

function parseAddressLines(label) {
  if (!label) return { primary: '', secondary: '' }
  const parts = label.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return { primary: label, secondary: '' }
  return { primary: parts[0], secondary: parts.slice(1).join(', ') }
}

function SearchIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M10 3a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function AddressGeocodeInput({
  value,
  onChange,
  onSelect,
  countryId,
  bbox,
  placeholder = '123 Main St, Portland, OR 97201',
  disabled = false,
  label = 'Street address',
  inputClassName,
  labelClassName,
  dropdownClassName,
  optionHighlightClassName,
  searchFn,
  requireCountry = true,
  dropdownInline = false,
  hideDropdown = false,
  searchDebounceMs = 0,
  minSearchLength = 3,
  isQuerySearchable,
  variant = 'default',
  onSearchingChange,
  onClear,
  showClearButton = false,
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selectedLabelRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [staleSuggestions, setStaleSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [hint, setHint] = useState('')

  const isPremium = variant === 'premium'
  const inputDisabled = disabled || (requireCountry && !countryId)

  const labelClasses =
    labelClassName ??
    (isPremium
      ? 'mb-2 block font-sans text-xs font-medium text-ink-secondary'
      : 'mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted')
  const inputClasses =
    inputClassName ??
    (isPremium
      ? 'w-full rounded-xl border border-white/10 bg-black/50 py-3.5 pl-10 pr-10 font-sans text-sm text-white placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-2 focus:ring-command-live/20 disabled:cursor-not-allowed disabled:opacity-40'
      : 'w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-[#ff9348]/50 focus:outline-none focus:ring-1 focus:ring-[#ff9348]/25 disabled:cursor-not-allowed disabled:opacity-40')
  const dropdownClasses =
    dropdownClassName ??
    (isPremium
      ? 'sleek-scrollbar pi-search-dropdown-enter absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-panel-surface/95 py-1.5 shadow-2xl backdrop-blur-md [color-scheme:dark]'
      : dropdownInline
        ? 'sleek-scrollbar mt-1 max-h-44 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]'
        : 'sleek-scrollbar absolute z-[50] mt-1 max-h-40 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]')
  const optionHighlightClasses =
    optionHighlightClassName ??
    (isPremium ? 'bg-command-live/15 text-white' : 'bg-[#ff9348]/15 text-white')

  const querySearchable = q => (isQuerySearchable ?? isSearchableAddressQuery)(q, minSearchLength)
  const displaySuggestions = suggestions.length > 0 ? suggestions : staleSuggestions
  const isStaleLoading = loading && suggestions.length === 0 && staleSuggestions.length > 0
  const inputHasFocus = () => inputRef.current === document.activeElement
  const openIfFocused = () => {
    if (inputHasFocus()) setOpen(true)
  }

  useEffect(() => {
    onSearchingChange?.(loading && querySearchable(value.trim()))
  }, [loading, value, onSearchingChange, minSearchLength])

  useEffect(() => {
    if (hideDropdown) {
      setSuggestions([])
      setStaleSuggestions([])
      setLoading(false)
      setOpen(false)
      setHint('')
      setHighlightIndex(-1)
      return undefined
    }

    const q = value.trim()

    if (requireCountry && !countryId) {
      setSuggestions([])
      setLoading(false)
      setHint('')
      return undefined
    }

    if (!q) {
      setSuggestions([])
      setStaleSuggestions([])
      setLoading(false)
      setOpen(false)
      setHint('')
      selectedLabelRef.current = null
      return undefined
    }

    if (selectedLabelRef.current === q) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      setHint('')
      return undefined
    }

    if (!querySearchable(q)) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      setHint('Keep typing, include a street name, e.g. 825 NE Multnomah St')
      return undefined
    }

    const controller = new AbortController()
    openIfFocused()
    setHint('')
    setLoading(true)
    if (suggestions.length > 0) {
      setStaleSuggestions(suggestions)
    }

    const runSearch = async () => {
      try {
        const search = searchFn ?? searchAddresses
        const results = await search(q, {
          countryId,
          bbox,
          limit: 5,
          signal: controller.signal,
        })
        const normalized = results.map(normalizeSuggestion).filter(Boolean)
        setSuggestions(normalized)
        setStaleSuggestions([])
        openIfFocused()
        setHighlightIndex(-1)
        if (normalized.length === 0) {
          setHint(
            searchFn
              ? 'No matches, try a fuller address with city and state.'
              : 'No matches in this country, try a fuller address.',
          )
        } else {
          setHint('')
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setHint('Address lookup unavailable, check your connection and try again.')
        openIfFocused()
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (searchDebounceMs <= 0) {
      runSearch()
    } else {
      const timer = setTimeout(runSearch, searchDebounceMs)
      return () => {
        clearTimeout(timer)
        controller.abort()
      }
    }

    return () => controller.abort()
  }, [value, countryId, bbox, searchFn, requireCountry, hideDropdown, searchDebounceMs, minSearchLength])

  useEffect(() => {
    setSuggestions([])
    setStaleSuggestions([])
    setOpen(false)
    setHint('')
    selectedLabelRef.current = null
  }, [countryId])

  useEffect(() => {
    const onDocPointerDown = e => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onDocPointerDown, { capture: true })
  }, [])

  const resolveTopMatch = async () => {
    const q = value.trim()
    if (!q) return
    if (requireCountry && !countryId) return
    if (!querySearchable(q)) return

    setLoading(true)
    setOpen(true)
    setHint('')
    try {
      const search = searchFn ?? searchAddresses
      const results = await search(q, { countryId, bbox, limit: 1 })
      const normalized = results.map(normalizeSuggestion).filter(Boolean)[0]
      if (normalized) {
        selectedLabelRef.current = normalized.label
        onSelect?.(normalized)
        setOpen(false)
        setHint('')
      } else {
        setHint('No match found. Try adding city and state.')
      }
    } catch {
      setHint('Address lookup unavailable. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const pick = item => {
    const normalized = normalizeSuggestion(item)
    if (!normalized) return
    selectedLabelRef.current = normalized.label
    setOpen(false)
    setSuggestions([])
    setStaleSuggestions([])
    setHighlightIndex(-1)
    setHint('')
    onSelect?.(normalized)
  }

  const onKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && displaySuggestions.length) {
        pick(displaySuggestions[highlightIndex])
      } else {
        resolveTopMatch()
      }
      return
    }

    if (e.key === 'ArrowDown' && displaySuggestions.length) {
      e.preventDefault()
      setOpen(true)
      setHighlightIndex(i => (i + 1) % displaySuggestions.length)
      return
    }
    if (e.key === 'ArrowUp' && displaySuggestions.length) {
      e.preventDefault()
      setOpen(true)
      setHighlightIndex(i => (i <= 0 ? displaySuggestions.length - 1 : i - 1))
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = !hideDropdown && open && (loading || displaySuggestions.length > 0 || hint)
  const canClear = showClearButton && value.trim() && !inputDisabled

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={listId} className={labelClasses}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        {isPremium ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {loading ? <SpinnerIcon className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
          </span>
        ) : null}
        <input
          id={listId}
          type="text"
          ref={inputRef}
          value={value}
          disabled={inputDisabled}
          autoComplete="street-address"
          placeholder={countryId ? placeholder : 'Select a country first'}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          onChange={e => {
            if (e.target.value !== selectedLabelRef.current) {
              selectedLabelRef.current = null
            }
            onChange(e.target.value)
          }}
          onFocus={() => {
            if (hideDropdown) return
            if (selectedLabelRef.current === value.trim()) return
            if (value.trim() && querySearchable(value.trim())) setOpen(true)
            else if (displaySuggestions.length) setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                setOpen(false)
                setHighlightIndex(-1)
              }
            }, 0)
          }}
          onKeyDown={onKeyDown}
          className={inputClasses}
        />
        {isPremium && canClear ? (
          <button
            type="button"
            onClick={() => {
              selectedLabelRef.current = null
              onClear?.()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-faint transition hover:bg-white/5 hover:text-white"
            aria-label="Clear address"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      {hint && !showDropdown && !loading ? (
        <p className={`mt-1.5 ${isPremium ? 'font-sans text-xs text-ink-faint' : 'font-mono text-[9px] text-ink-faint'}`}>
          {hint}
        </p>
      ) : null}
      {showDropdown ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className={dropdownClasses}
        >
          {loading && !displaySuggestions.length ? (
            <li className={`px-3 py-2.5 ${isPremium ? 'font-sans text-sm text-ink-faint' : 'font-mono text-[10px] text-ink-faint'}`}>
              Searching…
            </li>
          ) : null}
          {!loading && hint && !displaySuggestions.length ? (
            <li className={`px-3 py-2.5 ${isPremium ? 'font-sans text-sm text-ink-faint' : 'font-mono text-[10px] text-ink-faint'}`}>
              {hint}
            </li>
          ) : null}
          {displaySuggestions.map((item, index) => {
            const { primary, secondary } = isPremium
              ? parseAddressLines(item.label)
              : { primary: item.label, secondary: '' }
            return (
              <li key={item.id} role="option" aria-selected={highlightIndex === index}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(item)}
                  className={`w-full px-3 py-2.5 text-left transition ${
                    highlightIndex === index
                      ? optionHighlightClasses
                      : isPremium
                        ? 'text-ink-secondary hover:bg-white/5 hover:text-white'
                        : 'font-mono text-[11px] text-ink-secondary hover:bg-panel-bg hover:text-white'
                  } ${!isPremium ? 'font-mono text-[11px] leading-snug' : ''}`}
                >
                  {isPremium ? (
                    <>
                      <span className="block font-sans text-sm text-white">{primary}</span>
                      {secondary ? (
                        <span className="mt-0.5 block font-sans text-xs text-ink-muted">{secondary}</span>
                      ) : null}
                    </>
                  ) : (
                    item.label
                  )}
                </button>
              </li>
            )
          })}
          {isStaleLoading || (loading && displaySuggestions.length > 0) ? (
            <li className={`border-t border-white/5 px-3 py-1.5 ${isPremium ? 'font-sans text-xs text-ink-faint' : 'font-mono text-[9px] text-ink-faint'}`}>
              Updating…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
