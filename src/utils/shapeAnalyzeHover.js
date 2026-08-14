/** Move a screen point toward an interior target without overshooting the midpoint. */
export function insetPointToward(from, toward, px) {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const len = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || len < 1) return { x: from.x, y: from.y }
  const t = Math.min(px / len, 0.5)
  return { x: from.x + dx * t, y: from.y + dy * t }
}
