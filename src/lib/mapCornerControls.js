/** Zoom button size (px) */
export const MAP_ZOOM_WIDTH = 34
/** Max scale bar length (px) */
export const MAP_SCALE_MAX_WIDTH = 100

function getDecimalRoundNum(d) {
  const multiplier = 10 ** Math.ceil(-Math.log(d) / Math.LN10)
  return Math.round(d * multiplier) / multiplier
}

function getRoundNum(num) {
  const pow10 = 10 ** `${Math.floor(num)}`.length - 1
  let d = num / pow10
  d =
    d >= 10
      ? 10
      : d >= 5
        ? 5
        : d >= 3
          ? 3
          : d >= 2
            ? 2
            : d >= 1
              ? 1
              : getDecimalRoundNum(d)
  return pow10 * d
}

function scaleFromMeters(maxMeters, unit) {
  if (unit === 'imperial') {
    const maxFeet = 3.2808 * maxMeters
    if (maxFeet > 5280) {
      const raw = maxFeet / 5280
      const distance = getRoundNum(raw)
      return { distance, unit: 'mi', ratio: distance / raw }
    }
    const distance = getRoundNum(maxFeet)
    return { distance, unit: 'ft', ratio: distance / maxFeet }
  }
  if (maxMeters >= 1000) {
    const raw = maxMeters / 1000
    const distance = getRoundNum(raw)
    return { distance, unit: 'km', ratio: distance / raw }
  }
  const distance = getRoundNum(maxMeters)
  return { distance, unit: 'm', ratio: distance / maxMeters }
}

function formatScaleLabel(distance, unit) {
  const n = Number(distance)
  if (!Number.isFinite(n)) return ''
  if (unit === 'mi' || unit === 'km') return `${Math.round(n)} ${unit}`
  if (unit === 'ft') return `${Math.round(n)} ${unit}`
  return `${Math.round(n)} ${unit}`
}

/**
 * Bottom-left zoom (+/−) buttons and imperial scale bar (separate controls).
 * @implements {import('maplibre-gl').IControl}
 */
export class MapCornerControls {
  constructor(options = {}) {
    this.options = { maxWidth: MAP_SCALE_MAX_WIDTH, unit: 'imperial', ...options }
  }

  onAdd(map) {
    this._map = map
    const root = document.createElement('div')
    root.className = 'maplibregl-ctrl map-corner-controls'

    const zoomIn = document.createElement('button')
    zoomIn.type = 'button'
    zoomIn.className = 'map-corner-controls__zoom-btn map-corner-controls__cell'
    zoomIn.setAttribute('aria-label', 'Zoom in')
    zoomIn.innerHTML = '+'

    const zoomOut = document.createElement('button')
    zoomOut.type = 'button'
    zoomOut.className = 'map-corner-controls__zoom-btn map-corner-controls__cell'
    zoomOut.setAttribute('aria-label', 'Zoom out')
    zoomOut.innerHTML = '−'

    zoomIn.addEventListener('click', () => map.zoomIn())
    zoomOut.addEventListener('click', () => map.zoomOut())

    this._scale = document.createElement('div')
    this._scale.className = 'map-corner-controls__scale map-corner-controls__cell'

    this._bar = document.createElement('div')
    this._bar.className = 'map-corner-controls__scale-bar'
    this._scale.appendChild(this._bar)

    this._label = document.createElement('span')
    this._label.className = 'map-corner-controls__scale-label'
    this._scale.appendChild(this._label)

    root.appendChild(zoomIn)
    root.appendChild(zoomOut)
    root.appendChild(this._scale)

    this._container = root
    this._onMove = () => this._updateScale()
    map.on('move', this._onMove)
    this._updateScale()
    return root
  }

  onRemove() {
    this._container.remove()
    this._map.off('move', this._onMove)
    this._map = undefined
  }

  _updateScale() {
    const map = this._map
    const optWidth = this.options.maxWidth ?? MAP_SCALE_MAX_WIDTH
    const y = map._container.clientHeight / 2
    const x = map._container.clientWidth / 2
    const left = map.unproject([x - optWidth / 2, y])
    const right = map.unproject([x + optWidth / 2, y])

    const globeWidth = Math.round(map.project(right).x - map.project(left).x)
    const maxWidth = Math.min(optWidth, globeWidth, map._container.clientWidth)
    const maxMeters = left.distanceTo(right)

    const { distance, unit, ratio } = scaleFromMeters(maxMeters, this.options.unit)
    const barPx = Math.max(20, Math.min(optWidth, maxWidth * ratio))

    this._bar.style.width = `${barPx}px`
    this._label.textContent = formatScaleLabel(distance, unit)
  }

}
