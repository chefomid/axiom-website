import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import useMapPinAnchor from '../../hooks/useMapPinAnchor'

/** Zoom at or above this: HUD anchors near the subject pin. Below: dock on the map's right rail. */
export const MAP_SOURCE_HUD_ZOOM = 13.5

const HUD_WIDTH = 320
const PAD = 14
const PIN_GAP = 26

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function MapSourceDiscoveryHud({
  map,
  lat,
  lng,
  locationLocked,
  visible,
  children,
}) {
  const hostRef = useRef(null)
  const panelRef = useRef(null)
  const [panelSize, setPanelSize] = useState({ w: HUD_WIDTH, h: 280 })
  const { zoom, anchor } = useMapPinAnchor(map, lat, lng)

  const mode = useMemo(() => {
    if (!locationLocked || zoom == null || zoom < MAP_SOURCE_HUD_ZOOM) return 'docked'
    return 'anchored'
  }, [locationLocked, zoom])

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect
      if (!box) return
      setPanelSize({ w: box.width, h: box.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible, mode])

  const anchoredStyle = useMemo(() => {
    if (mode !== 'anchored' || !anchor || !hostRef.current) return null
    const { width, height } = hostRef.current.getBoundingClientRect()
    const w = panelSize.w || HUD_WIDTH
    const h = panelSize.h || 280

    let left = anchor.x + PIN_GAP
    let top = anchor.y - h * 0.35
    let flip = 'right'

    if (left + w > width - PAD) {
      left = anchor.x - PIN_GAP - w
      flip = 'left'
    }

    left = clamp(left, PAD, width - w - PAD)
    top = clamp(top, PAD, height - h - PAD)

    return { left, top, flip }
  }, [mode, anchor, panelSize.w, panelSize.h])

  if (!visible) return null

  return (
    <div ref={hostRef} className="map-source-hud-host pointer-events-none absolute inset-0 z-[22]">
      {mode === 'anchored' && anchor ? (
        <>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            <line
              className="map-source-hud__leader"
              x1={anchor.x}
              y1={anchor.y}
              x2={(anchoredStyle?.left ?? 0) + (panelSize.w || HUD_WIDTH) * 0.15}
              y2={(anchoredStyle?.top ?? 0) + (panelSize.h || 280) * 0.5}
            />
          </svg>
          <span
            className="map-source-hud__pin-ring pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-command-live/50 bg-command-live/20"
            style={{ left: anchor.x, top: anchor.y }}
            aria-hidden
          />
        </>
      ) : null}

      <div
        ref={panelRef}
        className={`map-source-hud pointer-events-auto ${
          mode === 'anchored' ? 'map-source-hud--anchored' : 'map-source-hud--docked'
        } ${mode === 'anchored' && anchoredStyle?.flip === 'left' ? 'map-source-hud--flip-left' : ''}`}
        style={
          mode === 'anchored' && anchoredStyle
            ? { left: anchoredStyle.left, top: anchoredStyle.top, width: HUD_WIDTH }
            : undefined
        }
      >
        <div className="map-source-hud__chrome">
          <p className="map-source-hud__eyebrow font-mono text-[8px] uppercase tracking-[0.24em] text-command-live">
            {mode === 'anchored' ? 'Subject · public records' : 'Public record sources'}
          </p>
          {mode === 'docked' ? (
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-ink-faint">
              Zoom in to anchor this panel to the property, or configure here for batch-ready runs.
            </p>
          ) : null}
        </div>
        <div className="map-source-hud__body sleek-scrollbar">{children}</div>
      </div>
    </div>
  )
}
