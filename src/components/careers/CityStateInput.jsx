import { useEffect, useId, useRef, useState } from 'react'
import { isSearchableCityQuery, searchCityStateLocations } from '../../services/geocode'
import { FieldShell } from './fields'

export default function CityStateInput({ field, value, error, onChange }) {
  const listId = useId()
  const rootRef = useRef(null)
  const selectedLabelRef = useRef(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const text = value ?? ''

  useEffect(() => {
    const q = text.trim()

    if (!q || selectedLabelRef.current === q) {
      setSuggestions([])
      setLoading(false)
      if (selectedLabelRef.current === q) setOpen(false)
      return undefined
    }

    if (!isSearchableCityQuery(q)) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      return undefined
    }

    const controller = new AbortController()
    setOpen(true)
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const results = await searchCityStateLocations(q, {
          limit: 6,
          signal: controller.signal,
        })
        setSuggestions(results)
        setOpen(true)
        setHighlightIndex(-1)
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function pick(item) {
    selectedLabelRef.current = item.label
    onChange(item.label)
    setOpen(false)
    setSuggestions([])
    setHighlightIndex(-1)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setHighlightIndex(index => (index + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setHighlightIndex(index => (index <= 0 ? suggestions.length - 1 : index - 1))
      return
    }
    if (event.key === 'Enter' && highlightIndex >= 0 && suggestions[highlightIndex]) {
      event.preventDefault()
      pick(suggestions[highlightIndex])
      return
    }
    if (event.key === 'Escape') setOpen(false)
  }

  const showDropdown = open && (loading || suggestions.length > 0)

  return (
    <FieldShell field={field} error={error}>
      <div ref={rootRef} className="relative">
        <input
          id={field.id}
          type="text"
          value={text}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          placeholder={field.placeholder ?? 'Start typing a city\u2026'}
          onChange={event => {
            if (event.target.value !== selectedLabelRef.current) {
              selectedLabelRef.current = null
            }
            onChange(event.target.value)
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-faint transition-colors focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25 ${
            error ? 'border-command-critical/60 focus:border-command-critical/60 focus:ring-command-critical/25' : ''
          }`.trim()}
        />

        {showDropdown ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-30 mt-1.5 max-h-48 w-full overflow-auto rounded-lg border border-panel-border bg-[#111] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            {loading && suggestions.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-ink-faint">Searching\u2026</li>
            ) : null}
            {suggestions.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightIndex === index}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => pick(item)}
                  className={`flex w-full px-3 py-2.5 text-left text-sm transition-colors ${
                    highlightIndex === index
                      ? 'bg-command-live/10 text-white'
                      : 'text-ink-secondary hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </FieldShell>
  )
}
