import { useCallback, useState } from 'react'
import {
  MAX_USER_PINS,
  createSegment,
  formatDistance,
  segmentKey,
} from '../utils/mapPins'

let pinCounter = 0

function nextPinId() {
  pinCounter += 1
  return `user-pin-${pinCounter}`
}

export default function useMapPins({ pushEvent } = {}) {
  const [pinMode, setPinMode] = useState(false)
  const [pins, setPins] = useState([])
  const [segments, setSegments] = useState([])
  const [selectedPinId, setSelectedPinId] = useState(null)

  const togglePinMode = useCallback(() => {
    setPinMode(prev => {
      const next = !prev
      if (!next) setSelectedPinId(null)
      pushEvent?.({
        text: next ? 'Pin measure mode enabled' : 'Pin measure mode disabled',
        type: next ? 'live' : 'stable',
        source: 'Map',
      })
      return next
    })
  }, [pushEvent])

  const clearPins = useCallback(() => {
    setPins([])
    setSegments([])
    setSelectedPinId(null)
    pushEvent?.({ text: 'All measure pins cleared', type: 'stable', source: 'Map' })
  }, [pushEvent])

  const addPin = useCallback(
    (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false

      setPins(prev => {
        if (prev.length >= MAX_USER_PINS) {
          pushEvent?.({
            text: `Pin limit reached (${MAX_USER_PINS})`,
            type: 'watch',
            source: 'Map',
          })
          return prev
        }
        const index = prev.length + 1
        const pin = {
          id: nextPinId(),
          lat,
          lng,
          label: `Pin ${index}`,
        }
        pushEvent?.({
          text: `${pin.label} placed`,
          type: 'live',
          source: 'Map',
        })
        return [...prev, pin]
      })
      setSelectedPinId(null)
      return true
    },
    [pushEvent],
  )

  const connectPins = useCallback(
    (fromId, toId) => {
      if (fromId === toId) return

      setPins(currentPins => {
        const from = currentPins.find(p => p.id === fromId)
        const to = currentPins.find(p => p.id === toId)
        if (!from || !to) return currentPins

        const key = segmentKey(fromId, toId)
        setSegments(prev => {
          if (prev.some(s => segmentKey(s.fromId, s.toId) === key)) {
            pushEvent?.({ text: 'Pins already connected', type: 'watch', source: 'Map' })
            return prev
          }
          const seg = createSegment(from, to)
          pushEvent?.({
            text: `Measure · ${formatDistance(seg.distanceMiles)} between ${from.label} and ${to.label}`,
            type: 'stable',
            source: 'Map',
          })
          return [...prev, seg]
        })
        return currentPins
      })
      setSelectedPinId(null)
    },
    [pushEvent],
  )

  const selectPin = useCallback(
    id => {
      setSelectedPinId(prev => {
        if (prev === id) return null
        if (prev && prev !== id) {
          connectPins(prev, id)
          return null
        }
        return id
      })
    },
    [connectPins],
  )

  const removePin = useCallback(
    id => {
      setPins(prev => {
        const pin = prev.find(p => p.id === id)
        if (!pin) return prev
        pushEvent?.({
          text: `${pin.label} removed`,
          type: 'stable',
          source: 'Map',
        })
        return prev.filter(p => p.id !== id)
      })
      setSegments(prev => prev.filter(s => s.fromId !== id && s.toId !== id))
      setSelectedPinId(prev => (prev === id ? null : prev))
    },
    [pushEvent],
  )

  return {
    pinMode,
    pins,
    segments,
    selectedPinId,
    pinCount: pins.length,
    togglePinMode,
    addPin,
    selectPin,
    removePin,
    clearPins,
  }
}
