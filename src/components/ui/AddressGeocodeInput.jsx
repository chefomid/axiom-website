import { useEffect, useId, useRef, useState } from 'react'

import { isSearchableAddressQuery, searchAddresses } from '../../services/geocode'

export default function AddressGeocodeInput({
  value,
  onChange,
  onSelect,
  countryId,
  bbox,
  placeholder = '123 Main St, Portland, OR 97201',
  disabled = false,
  label = 'Street address',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const selectedLabelRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [hint, setHint] = useState('')

  const inputDisabled = disabled || !countryId

  useEffect(() => {
    const q = value.trim()

    if (!countryId) {
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
      setHint('Include a street name — e.g. 825 NE Multnomah St')
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setHint('')

    const timer = setTimeout(async () => {
      try {
        const results = await searchAddresses(q, {
          countryId,
          bbox,
          limit: 5,
          signal: controller.signal,
        })
        setSuggestions(results)
        setOpen(results.length > 0)
        setHighlightIndex(-1)
        if (results.length === 0) {
          setHint('No matches in this country — try a fuller address.')
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setSuggestions([])
        setHint('Could not load address suggestions.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 320)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, countryId, bbox])

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

  const pick = item => {
    selectedLabelRef.current = item.label
    onChange(item.label)
    onSelect?.({ lat: item.lat, lng: item.lng, label: item.label })
    setOpen(false)
    setSuggestions([])
    setHighlightIndex(-1)
    setHint('')
  }

  const onKeyDown = e => {
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
      <label htmlFor={listId} className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </label>
      <input
        id={listId}
        type="text"
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
          if (selectedLabelRef.current === value.trim()) return
          if (suggestions.length) setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-[#2a2a2a] bg-[#111] px-3 py-2 font-mono text-[11px] text-white placeholder:text-ink-faint focus:border-[#ff9348]/50 focus:outline-none focus:ring-1 focus:ring-[#ff9348]/25 disabled:cursor-not-allowed disabled:opacity-40"
      />
      {loading && (
        <p className="mt-1.5 font-mono text-[10px] text-ink-faint">Searching…</p>
      )}
      {hint && !loading && (
        <p className="mt-1.5 font-mono text-[10px] text-ink-faint">{hint}</p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="sleek-scrollbar absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-[#333] bg-[#0d0d0d] py-1 shadow-xl [color-scheme:dark]"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="option" aria-selected={highlightIndex === index}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(item)}
                className={`w-full px-3 py-2 text-left font-mono text-[11px] leading-snug transition ${
                  highlightIndex === index
                    ? 'bg-[#ff9348]/15 text-white'
                    : 'text-ink-secondary hover:bg-[#1a1a1a] hover:text-white'
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
