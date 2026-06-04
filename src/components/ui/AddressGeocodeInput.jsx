import { useEffect, useId, useRef, useState } from 'react'

import { isSearchableAddressQuery, searchAddresses } from '../../services/geocode'
import { normalizeSuggestion } from '../../utils/coords'

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
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selectedLabelRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [hint, setHint] = useState('')
  const autoCloseTimerRef = useRef(null)

  const inputDisabled = disabled || (requireCountry && !countryId)

  const labelClasses =
    labelClassName ??
    'mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted'
  const inputClasses =
    inputClassName ??
    'w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-[#ff9348]/50 focus:outline-none focus:ring-1 focus:ring-[#ff9348]/25 disabled:cursor-not-allowed disabled:opacity-40'
  const dropdownClasses =
    dropdownClassName ??
    (dropdownInline
      ? 'sleek-scrollbar mt-2 max-h-44 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]'
      : 'sleek-scrollbar absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]')
  const optionHighlightClasses =
    optionHighlightClassName ?? 'bg-[#ff9348]/15 text-white'

  useEffect(() => {
    if (hideDropdown) {
      setSuggestions([])
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
      setLoading(false)
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

    if (!isSearchableAddressQuery(q)) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      setHint('Include a street name, e.g. 123 Main St, Portland, OR')
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setHint('')

    const timer = setTimeout(async () => {
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
        setOpen(normalized.length > 0)
        setHighlightIndex(-1)
        if (normalized.length === 0) {
          setHint(searchFn ? 'No matches — try a fuller address with city and state.' : 'No matches in this country — try a fuller address.')
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setSuggestions([])
        setOpen(false)
        setHint('Address lookup unavailable — check your connection and try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 320)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, countryId, bbox, searchFn, requireCountry, hideDropdown])

  useEffect(() => {
    setSuggestions([])
    setOpen(false)
    setHint('')
    selectedLabelRef.current = null
  }, [countryId])

  useEffect(() => {
    const onDocClick = e => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const clearAutoCloseTimer = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = null
    }
  }

  const scheduleAutoClose = () => {
    clearAutoCloseTimer()
    autoCloseTimerRef.current = setTimeout(() => {
      setOpen(false)
    }, 1000)
  }

  useEffect(() => {
    if (hideDropdown) return undefined
    if (!open || loading || suggestions.length === 0) {
      clearAutoCloseTimer()
      return undefined
    }

    // Auto-hide the dropdown shortly after it appears to reduce clutter.
    // Pause the timer when the user is actively navigating the list.
    if (highlightIndex >= 0) {
      clearAutoCloseTimer()
      return undefined
    }

    if (document.activeElement === inputRef.current) {
      scheduleAutoClose()
    } else {
      clearAutoCloseTimer()
    }

    return clearAutoCloseTimer
  }, [open, loading, suggestions.length, highlightIndex, hideDropdown])

  const resolveTopMatch = async () => {
    const q = value.trim()
    if (!q) return
    if (requireCountry && !countryId) return
    if (!isSearchableAddressQuery(q)) return

    setLoading(true)
    setHint('')
    try {
      const search = searchFn ?? searchAddresses
      const results = await search(q, { countryId, bbox, limit: 1 })
      const normalized = results.map(normalizeSuggestion).filter(Boolean)[0]
      if (normalized) {
        selectedLabelRef.current = normalized.label
        onChange(normalized.label)
        onSelect?.(normalized)
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
    onChange(normalized.label)
    onSelect?.(normalized)
    clearAutoCloseTimer()
    setOpen(false)
    setSuggestions([])
    setHighlightIndex(-1)
    setHint('')
  }

  const onKeyDown = e => {
    if (hideDropdown && e.key === 'Enter') {
      e.preventDefault()
      resolveTopMatch()
      return
    }

    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      pick(suggestions[highlightIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={listId} className={labelClasses}>
        {label}
      </label>
      <input
        id={listId}
        type="text"
        ref={inputRef}
        value={value}
        disabled={inputDisabled}
        autoComplete="street-address"
        placeholder={countryId ? placeholder : 'Select a country first'}
        role="combobox"
        aria-expanded={open}
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
          if (suggestions.length) setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={inputClasses}
      />
      {loading && (
        <p className="mt-1.5 font-mono text-[10px] text-ink-faint">Searching…</p>
      )}
      {hint && !loading && (
        <p className="mt-1.5 font-mono text-[10px] text-ink-faint">{hint}</p>
      )}
      {!hideDropdown && open && suggestions.length > 0 && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className={dropdownClasses}
          onMouseEnter={clearAutoCloseTimer}
          onMouseLeave={() => {
            if (document.activeElement === inputRef.current && highlightIndex < 0) scheduleAutoClose()
          }}
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="option" aria-selected={highlightIndex === index}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(item)}
                className={`w-full px-3 py-2 text-left font-mono text-[11px] leading-snug transition ${
                  highlightIndex === index
                    ? optionHighlightClasses
                    : 'text-ink-secondary hover:bg-panel-bg hover:text-white'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
