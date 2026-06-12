import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import useMapPinAnchor from '../../hooks/useMapPinAnchor'

/** Zoom at or above this: panel anchors near the subject pin. Below: dock on the map rail. */
export const MAP_WORKFLOW_HUD_ZOOM = 13.5

const DEFAULT_WIDTH = 340
const PAD = 14
const PIN_GAP = 26

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Map-anchored panel shell: setup (centered), docked (right rail), anchored (near pin).
 * @param {'setup'|'docked'|'anchored'} mode
 */
export default function MapAnchoredPanel({
  map,
  lat,
  lng,
  mode = 'setup',
  visible = true,
  width = DEFAULT_WIDTH,
  collapsed = false,
  showPinDecor = false,
  banner = null,
  onBannerClick,
  children,
  className = '',
}) {
  const hostRef = useRef(null)
  const panelRef = useRef(null)
  const [panelSize, setPanelSize] = useState({ w: width, h: 280 })
  const { anchor } = useMapPinAnchor(map, lat, lng)

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
    const { width: hostW, height: hostH } = hostRef.current.getBoundingClientRect()
    const w = panelSize.w || width
    const h = panelSize.h || 280

    let left = anchor.x + PIN_GAP
    let top = anchor.y - h * 0.35
    let flip = 'right'

    if (left + w > hostW - PAD) {
      left = anchor.x - PIN_GAP - w
      flip = 'left'
    }

    left = clamp(left, PAD, hostW - w - PAD)
    top = clamp(top, PAD, hostH - h - PAD)

    return { left, top, flip }
  }, [mode, anchor, panelSize.w, panelSize.h, width])

  if (!visible) return null

  const modeClass =
    mode === 'setup'
      ? 'map-workflow-hud--setup'
      : mode === 'anchored'
        ? 'map-source-hud--anchored'
        : 'map-source-hud--docked'

  const flipClass =
    mode === 'anchored' && anchoredStyle?.flip === 'left' ? 'map-source-hud--flip-left' : ''

  const collapsedClass = collapsed ? 'map-workflow-hud--collapsed' : ''

  return (
    <div
      ref={hostRef}
      className={`map-source-hud-host map-workflow-hud-host pointer-events-none absolute inset-0 z-[24] ${className}`}
    >
      {mode === 'setup' && !collapsed ? (
        <div className="map-workflow-hud__scrim pointer-events-none absolute inset-0 bg-[#050505]/55" aria-hidden />
      ) : null}

      {showPinDecor && mode === 'anchored' && anchor && !collapsed ? (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <line
              className="map-source-hud__leader"
              x1={anchor.x}
              y1={anchor.y}
              x2={(anchoredStyle?.left ?? 0) + (panelSize.w || width) * 0.15}
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
        className={`map-source-hud map-workflow-hud pointer-events-auto ${modeClass} ${flipClass} ${collapsedClass}`}
        style={
          collapsed
            ? undefined
            : mode === 'anchored' && anchoredStyle
              ? { left: anchoredStyle.left, top: anchoredStyle.top, width }
              : mode === 'setup'
                ? { width: `min(${width}px, 92vw)` }
                : undefined
        }
      >
        {banner ? (
          <div
            className={`workflow-hud-banner shrink-0 ${collapsed ? 'workflow-hud-banner--collapsed' : ''}`}
            onClick={collapsed ? onBannerClick : undefined}
            onKeyDown={
              collapsed
                ? e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onBannerClick?.(e)
                    }
                  }
                : undefined
            }
            role={collapsed ? 'button' : undefined}
            tabIndex={collapsed ? 0 : undefined}
            aria-expanded={!collapsed}
          >
            {banner}
          </div>
        ) : null}
        {children && !collapsed ? (
          <div className="map-source-hud__body map-workflow-hud__body sleek-scrollbar">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
