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

const FAULT_TOGGLE_ICON = `
<svg class="analysis-fault-toggle__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4 17 L8.5 10.5 L12 13.5 L16 7 L20 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

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

    this._label = document.createElement('span')
    this._label.className = 'map-corner-controls__scale-label'

    const satellite = this.options.satellite
    const faultLines = this.options.faultLines
    if (satellite || faultLines) {
      this._scale.classList.add('map-corner-controls__scale--with-map-toggles')

      const scaleMain = document.createElement('div')
      scaleMain.className = 'map-corner-controls__scale-main'
      scaleMain.appendChild(this._bar)
      scaleMain.appendChild(this._label)

      const divider = document.createElement('span')
      divider.className = 'map-corner-controls__scale-divider'
      divider.setAttribute('aria-hidden', 'true')

      const toggles = document.createElement('div')
      toggles.className = 'map-corner-controls__map-toggles'

      if (faultLines) {
        this._faultBtn = document.createElement('button')
        this._faultBtn.type = 'button'
        this._faultBtn.className = 'analysis-fault-toggle'
        this._faultBtn.setAttribute('aria-label', 'Toggle fault lines')
        this._faultBtn.title = 'Fault Lines'
        this._faultBtn.innerHTML = FAULT_TOGGLE_ICON
        this._faultBtn.addEventListener('click', () => faultLines.onToggle?.())
        toggles.appendChild(this._faultBtn)
      }

      if (satellite) {
        this._satelliteBtn = document.createElement('button')
        this._satelliteBtn.type = 'button'
        this._satelliteBtn.className = 'analysis-satellite-toggle'
        this._satelliteBtn.setAttribute('aria-label', 'Toggle satellite imagery')
        this._satelliteBtn.title = 'Show satellite imagery'
        if (satellite.previewBackground) {
          this._satelliteBtn.style.background = satellite.previewBackground
        }
        this._satelliteBtn.addEventListener('click', () => satellite.onToggle?.())
        toggles.appendChild(this._satelliteBtn)
      }

      this._scale.appendChild(scaleMain)
      this._scale.appendChild(divider)
      this._scale.appendChild(toggles)
    } else {
      this._scale.appendChild(this._bar)
      this._scale.appendChild(this._label)
    }

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

  setSatelliteActive(active) {
    if (!this._satelliteBtn) return
    const on = Boolean(active)
    this._satelliteBtn.setAttribute('aria-pressed', String(on))
    this._satelliteBtn.title = on ? 'Hide satellite imagery' : 'Show satellite imagery'
  }

  setSatelliteVisible(visible) {
    if (!this._satelliteBtn) return
    const show = Boolean(visible)
    this._satelliteBtn.classList.toggle('analysis-satellite-toggle--hidden', !show)
    this._satelliteBtn.setAttribute('aria-hidden', String(!show))
    if (!show) {
      this._satelliteBtn.setAttribute('tabindex', '-1')
    } else {
      this._satelliteBtn.removeAttribute('tabindex')
    }
  }

  setFaultLinesActive(active) {
    if (!this._faultBtn) return
    this._faultBtn.setAttribute('aria-pressed', String(Boolean(active)))
    this._faultBtn.title = 'Fault Lines'
  }
}
