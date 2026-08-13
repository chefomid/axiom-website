/** Canvas-drawn fire glyph for MapLibre symbol layer (emoji-like, no emoji font dependency). */

export const WILDFIRE_ICON_ID = 'axiom-wildfire-fire'

/**
 * Register a fire icon on a MapLibre map once.
 * @param {import('maplibre-gl').Map} map
 */
export function ensureWildfireIcon(map) {
  if (!map || map.hasImage?.(WILDFIRE_ICON_ID)) return

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)

  // Outer glow
  const glow = ctx.createRadialGradient(size * 0.5, size * 0.62, 2, size * 0.5, size * 0.55, size * 0.42)
  glow.addColorStop(0, 'rgba(255, 180, 60, 0.55)')
  glow.addColorStop(1, 'rgba(255, 80, 20, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(size * 0.5, size * 0.58, size * 0.4, 0, Math.PI * 2)
  ctx.fill()

  // Flame body
  ctx.beginPath()
  ctx.moveTo(size * 0.5, size * 0.1)
  ctx.bezierCurveTo(size * 0.78, size * 0.32, size * 0.86, size * 0.55, size * 0.7, size * 0.78)
  ctx.bezierCurveTo(size * 0.62, size * 0.92, size * 0.38, size * 0.92, size * 0.3, size * 0.78)
  ctx.bezierCurveTo(size * 0.14, size * 0.55, size * 0.22, size * 0.32, size * 0.5, size * 0.1)
  ctx.closePath()

  const flame = ctx.createLinearGradient(size * 0.5, size * 0.12, size * 0.5, size * 0.9)
  flame.addColorStop(0, '#ffe566')
  flame.addColorStop(0.35, '#ff9a1f')
  flame.addColorStop(0.7, '#f04420')
  flame.addColorStop(1, '#b91c1c')
  ctx.fillStyle = flame
  ctx.fill()

  // Inner core
  ctx.beginPath()
  ctx.moveTo(size * 0.5, size * 0.38)
  ctx.bezierCurveTo(size * 0.62, size * 0.5, size * 0.64, size * 0.62, size * 0.56, size * 0.74)
  ctx.bezierCurveTo(size * 0.52, size * 0.8, size * 0.48, size * 0.8, size * 0.44, size * 0.74)
  ctx.bezierCurveTo(size * 0.36, size * 0.62, size * 0.38, size * 0.5, size * 0.5, size * 0.38)
  ctx.closePath()
  const core = ctx.createLinearGradient(size * 0.5, size * 0.4, size * 0.5, size * 0.78)
  core.addColorStop(0, '#fff7cc')
  core.addColorStop(1, '#ffb020')
  ctx.fillStyle = core
  ctx.fill()

  const data = ctx.getImageData(0, 0, size, size)
  map.addImage(WILDFIRE_ICON_ID, data, { pixelRatio: 2 })
}
