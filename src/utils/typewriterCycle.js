export const TYPEWRITER_MESSAGES = ['LOADING...', 'connecting with data source...']
export const TYPEWRITER_TRACKING_EM = 0.14

export function longestTypewriterMessage(messages = TYPEWRITER_MESSAGES) {
  return messages.reduce((longest, message) =>
    message.length > longest.length ? message : longest,
  '')
}

/** Fixed box width: longest line, letter-spacing, and caret. Does not follow the typed text. */
export function typewriterBoxWidthCss(message = longestTypewriterMessage()) {
  const letters = message.length
  const gaps = Math.max(letters - 1, 0)
  return `calc(${letters}ch + ${gaps} * ${TYPEWRITER_TRACKING_EM}em + 0.85em)`
}

export const TYPEWRITER_TYPE_MS = 38
export const TYPEWRITER_DELETE_MS = 22
export const TYPEWRITER_HOLD_MS = 1200

export function typewriterStep({
  text,
  messageIndex,
  phase,
  messages = TYPEWRITER_MESSAGES,
}) {
  const full = messages[messageIndex] ?? ''

  if (phase === 'typing') {
    if (text.length < full.length) {
      return { text: full.slice(0, text.length + 1), messageIndex, phase: 'typing' }
    }
    return { text, messageIndex, phase: 'holding' }
  }

  if (phase === 'holding') {
    return { text, messageIndex, phase: 'deleting' }
  }

  if (text.length > 0) {
    return { text: text.slice(0, -1), messageIndex, phase: 'deleting' }
  }

  return {
    text: '',
    messageIndex: messages.length ? (messageIndex + 1) % messages.length : 0,
    phase: 'typing',
  }
}

export function typewriterDelayMs(
  phase,
  {
    typeMs = TYPEWRITER_TYPE_MS,
    deleteMs = TYPEWRITER_DELETE_MS,
    holdMs = TYPEWRITER_HOLD_MS,
  } = {},
) {
  if (phase === 'holding') return holdMs
  if (phase === 'deleting') return deleteMs
  return typeMs
}
