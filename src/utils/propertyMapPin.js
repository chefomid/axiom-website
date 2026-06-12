/** Subject-property map target, amber reticle aligned with Property Intelligence UI. */
export function createPropertyMapPinElement() {
  const el = document.createElement('div')
  el.className = 'property-target-marker property-target-marker--locking'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', 'Subject property location')
  el.innerHTML = `
    <span class="property-target-marker__pulse" aria-hidden="true"></span>
    <span class="property-target-marker__pulse property-target-marker__pulse--delayed" aria-hidden="true"></span>
    <span class="property-target-marker__glow" aria-hidden="true"></span>
    <svg class="property-target-marker__ring-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle class="property-target-marker__ring" cx="24" cy="24" r="14" />
    </svg>
    <span class="property-target-marker__core" aria-hidden="true"></span>
  `.trim()
  return el
}

/** Re-run lock-in motion when the map flies to a new subject. */
export function replayPropertyTargetLockAnimation(el) {
  if (!el) return
  el.classList.remove('property-target-marker--locking')
  void el.offsetWidth
  el.classList.add('property-target-marker--locking')
}

/** Dim pin while user edits address after a prior lock. */
export function setPropertyMapPinPending(el, pending) {
  if (!el) return
  el.classList.toggle('property-target-marker--pending', Boolean(pending))
}
