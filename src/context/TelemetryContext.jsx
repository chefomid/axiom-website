import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const MAX_ENTRIES = 12
const DEDUPE_MS = 4000

const TelemetryContext = createContext(null)

function formatTime(date = new Date()) {
  return date.toTimeString().slice(0, 8)
}

let entryCounter = 0

export function TelemetryProvider({ children }) {
  const [entries, setEntries] = useState(() => [
    {
      id: 'boot-0',
      time: formatTime(),
      text: 'Map ready',
      type: 'stable',
      source: 'Map',
    },
  ])
  const counterRef = useRef(0)
  const lastEntryRef = useRef(null)

  const pushEvent = useCallback(({ text, type = 'live', source = 'System' }) => {
    if (!text) return

    const now = Date.now()
    const last = lastEntryRef.current
    if (last && last.text === text && last.source === source && now - last.at < DEDUPE_MS) {
      return last.entry
    }

    counterRef.current += 1
    entryCounter += 1
    const entry = {
      id: `evt-${entryCounter}`,
      time: formatTime(),
      text,
      type,
      source,
    }
    lastEntryRef.current = { text, source, at: now, entry }
    setEntries(prev => [...prev, entry].slice(-MAX_ENTRIES))
    return entry
  }, [])

  const value = useMemo(() => ({ entries, pushEvent }), [entries, pushEvent])

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) {
    throw new Error('useTelemetry must be used within TelemetryProvider')
  }
  return ctx
}
