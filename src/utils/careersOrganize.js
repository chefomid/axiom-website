/** Client-side careers organize guards (server mirrors in api/careers/organizeUtils.js). */

export function wordCount(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function lightOrganizeText(text) {
  const trimmed = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function shouldUseLlmOrganize(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return false

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 12) return false

  const normalized = words.map(w => w.toLowerCase().replace(/[^\w]/g, ''))
  const unique = new Set(normalized)
  if (words.length >= 4 && unique.size <= 2) return false

  return true
}
