import { useCallback, useState } from 'react'
import {
  MAX_USER_PINS,
  computeSquarePinPositions,
  createSegment,
  findShapeById,
  formatArea,
  formatDistance,
  pinsInChain,
  removeSegment,
  segmentInterferingPin,
  segmentKey,
} from '../utils/mapPins'

let pinCounter = 0

function nextPinId() {
  pinCounter += 1
  return `user-pin-${pinCounter}`
}

function appendSegment(segs, fromPin, toPin) {
  const key = segmentKey(fromPin.id, toPin.id)
  if (segs.some(s => segmentKey(s.fromId, s.toId) === key)) return segs
  return [...segs, createSegment(fromPin, toPin)]
}

function rebuildGroupSegments(segs, groupPins) {
  const groupIds = new Set(groupPins.map(p => p.id))
  const filtered = segs.filter(seg => !(groupIds.has(seg.fromId) && groupIds.has(seg.toId)))
  let next = filtered
  for (let i = 0; i < groupPins.length; i += 1) {
    next = appendSegment(next, groupPins[i], groupPins[(i + 1) % groupPins.length])
  }
  return next
}

export default function useMapPins({ pushEvent } = {}) {
  const [pinMode, setPinMode] = useState(false)
  const [pins, setPins] = useState([])
  const [segments, setSegments] = useState([])
  const [selectedPinId, setSelectedPinId] = useState(null)
  const [activeChainId, setActiveChainId] = useState(0)

  const togglePinMode = useCallback(() => {
    setPinMode(prev => {
      const next = !prev
      if (!next) setSelectedPinId(null)
      pushEvent?.({
        text: next ? 'Measure mode on, tap the map to place pins and draw lines' : 'Measure mode off',
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
    setActiveChainId(0)
    pushEvent?.({ text: 'Measure pins cleared', type: 'stable', source: 'Map' })
  }, [pushEvent])

  const breakPinChain = useCallback(() => {
    setActiveChainId(id => id + 1)
    setSelectedPinId(null)
    pushEvent?.({
      text: 'Chain broken, next pin will not connect',
      type: 'live',
      source: 'Map',
    })
    return true
  }, [pushEvent])

  const breakPinChainBlocked = useCallback(() => {
    pushEvent?.({
      text: 'Right-click empty map away from pins to break the chain',
      type: 'watch',
      source: 'Map',
    })
  }, [pushEvent])

  const addPin = useCallback(
    (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false

      let added = false

      setPins(prev => {
        if (prev.length >= MAX_USER_PINS) {
          pushEvent?.({
            text: `You can place up to ${MAX_USER_PINS} pins`,
            type: 'watch',
            source: 'Map',
          })
          return prev
        }

        const index = prev.length + 1
        const chainPins = pinsInChain(prev, activeChainId)
        const chainIndex = chainPins.length
        let pinChainId = activeChainId
        let previousPin = chainIndex > 0 ? chainPins[chainIndex - 1] : null

        const pin = {
          id: nextPinId(),
          lat,
          lng,
          label: `Pin ${index}`,
          chainId: pinChainId,
        }

        const excludeIds = new Set([pin.id])
        if (previousPin) {
          excludeIds.add(previousPin.id)
          const interferer = segmentInterferingPin(previousPin, pin, prev, excludeIds)
          if (interferer) {
            pinChainId = activeChainId + 1
            pin.chainId = pinChainId
            previousPin = null
            setActiveChainId(pinChainId)
            pushEvent?.({
              text: `${interferer.label} blocks the line, ${pin.label} starts a new chain`,
              type: 'watch',
              source: 'Map',
            })
          }
        }

        const activeChainPins = previousPin ? [...chainPins, pin] : [pin]
        const activeChainIndex = activeChainPins.length - 1
        const closesQuad = previousPin != null && (activeChainIndex + 1) % 4 === 0
        const closesTriangle =
          previousPin != null &&
          activeChainIndex >= 2 &&
          (activeChainIndex + 1) % 3 === 0 &&
          !closesQuad
        const triangleStartPin = closesTriangle ? activeChainPins[activeChainIndex - 2] : null
        const quadStartPin = closesQuad ? activeChainPins[activeChainIndex - 3] : null
        const quadDiagonalPin = closesQuad ? activeChainPins[activeChainIndex - 1] : null

        const canConnectPrevious =
          previousPin &&
          !segmentInterferingPin(previousPin, pin, prev, new Set([pin.id, previousPin.id]))
        const canCloseTriangle =
          closesTriangle &&
          triangleStartPin &&
          previousPin &&
          !segmentInterferingPin(triangleStartPin, pin, prev, new Set([pin.id, triangleStartPin.id, previousPin.id]))
        const canCloseQuad =
          closesQuad &&
          quadStartPin &&
          quadDiagonalPin &&
          !segmentInterferingPin(quadStartPin, pin, prev, new Set([pin.id, quadStartPin.id, quadDiagonalPin.id]))

        if (canConnectPrevious || canCloseTriangle || canCloseQuad) {
          setSegments(segs => {
            let next = segs
            if (canConnectPrevious) next = appendSegment(next, previousPin, pin)
            if (canCloseTriangle) next = appendSegment(next, triangleStartPin, pin)
            if (canCloseQuad) {
              next = appendSegment(next, pin, quadStartPin)
              next = removeSegment(next, quadStartPin.id, quadDiagonalPin.id)
            }
            return next
          })
        }

        const shapeClosed = canCloseQuad || canCloseTriangle
        if (canCloseQuad && quadStartPin && canConnectPrevious) {
          pushEvent?.({
            text: `Square region closed, ${quadStartPin.label} to ${pin.label}`,
            type: 'stable',
            source: 'Map',
          })
        } else if (canCloseTriangle && triangleStartPin && canConnectPrevious) {
          pushEvent?.({
            text: `Triangle closed, ${triangleStartPin.label}, ${previousPin.label}, ${pin.label}`,
            type: 'stable',
            source: 'Map',
          })
        } else if (canConnectPrevious) {
          pushEvent?.({
            text: `${formatDistance(createSegment(previousPin, pin).distanceMiles)} between ${previousPin.label} and ${pin.label}`,
            type: 'stable',
            source: 'Map',
          })
        } else {
          pushEvent?.({
            text: `${pin.label} placed`,
            type: 'live',
            source: 'Map',
          })
        }

        if (shapeClosed) {
          setActiveChainId(id => Math.max(id, pinChainId) + 1)
        }

        added = true
        return [...prev, pin]
      })
      setSelectedPinId(null)
      return added
    },
    [pushEvent, activeChainId],
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
            text: `${formatDistance(seg.distanceMiles)} between ${from.label} and ${to.label}`,
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

  const removeShape = useCallback(
    shapeId => {
      const shape = findShapeById(shapeId, pins, segments)
      if (!shape) return

      const pinIds = new Set(shape.pins.map(p => p.id))
      setPins(prev => prev.filter(p => !pinIds.has(p.id)))
      setSegments(prev =>
        prev.filter(seg => !pinIds.has(seg.fromId) && !pinIds.has(seg.toId)),
      )
      setSelectedPinId(prev => (prev && pinIds.has(prev) ? null : prev))
      pushEvent?.({
        text: `${shape.shape === 'quad' ? 'Square' : 'Triangle'} removed (${formatArea(shape.areaSqMiles)})`,
        type: 'stable',
        source: 'Map',
      })
    },
    [pins, segments, pushEvent],
  )

  const movePin = useCallback((id, lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    setPins(prev => {
      const nextPins = prev.map(p => (p.id === id ? { ...p, lat, lng } : p))
      const pinById = new Map(nextPins.map(p => [p.id, p]))
      setSegments(segs =>
        segs.map(seg => {
          const from = pinById.get(seg.fromId)
          const to = pinById.get(seg.toId)
          if (!from || !to) return seg
          return createSegment(from, to)
        }),
      )
      return nextPins
    })
  }, [])

  const makeSquareFromLastFour = useCallback(() => {
    setPins(prev => {
      const lastPin = prev[prev.length - 1]
      const chainId = lastPin.chainId ?? 0
      const chainPins = pinsInChain(prev, chainId)
      if (chainPins.length < 4) {
        pushEvent?.({ text: 'Place at least 4 pins in this chain to form a square', type: 'watch', source: 'Map' })
        return prev
      }

      const group = chainPins.slice(-4)
      const groupStart = prev.findIndex(p => p.id === group[0].id)
      const positions = computeSquarePinPositions(group)
      if (!positions) return prev

      const nextPins = prev.map((pin, index) => {
        const groupIndex = index - groupStart
        if (groupIndex < 0 || groupIndex >= 4) return pin
        return { ...pin, lat: positions[groupIndex].lat, lng: positions[groupIndex].lng }
      })

      const squaredGroup = nextPins.slice(groupStart, groupStart + 4)
      setSegments(segs => rebuildGroupSegments(segs, squaredGroup))
      pushEvent?.({
        text: `Squared ${group[0].label}–${group[3].label}`,
        type: 'stable',
        source: 'Map',
      })
      return nextPins
    })
    setSelectedPinId(null)
  }, [pushEvent])

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
    removeShape,
    movePin,
    makeSquareFromLastFour,
    breakPinChain,
    breakPinChainBlocked,
    clearPins,
  }
}
