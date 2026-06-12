/** Shared rules for careers dictation organize (mirrored in src/utils/careersOrganize.js). */

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

/**
 * Thin or test-like answers should not be sent through an LLM rewrite.
 */
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

/**
 * Reject LLM output that invents too much beyond the source transcript.
 */
export function isOrganizeExpansionAcceptable(source, organized) {
  const sourceWords = wordCount(source)
  const organizedWords = wordCount(organized)
  if (sourceWords === 0) return false
  if (organizedWords > Math.max(sourceWords * 1.35, sourceWords + 8)) return false
  return true
}
