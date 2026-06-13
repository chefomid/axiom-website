/** Shared rules for careers dictation organize (mirrored in src/utils/careersOrganize.js). */

const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-mini-4b-instruct'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

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

export function formatOrganizeModelLabel(model, provider) {
  const id = String(model ?? '').toLowerCase()
  if (provider === 'nvidia') {
    if (id.includes('nemotron')) return 'Nemotron Mini'
    const short = String(model ?? '').split('/').pop()
    return short || 'NVIDIA'
  }
  if (provider === 'openai') {
    if (id.includes('gpt-4o-mini')) return 'GPT-4o mini'
    return model || 'OpenAI'
  }
  return null
}

export function resolveOrganizeLlmConfig(env = process.env) {
  const nvidiaKey = env.NVIDIA_API_KEY?.trim()
  if (nvidiaKey) {
    const baseUrl = (env.CAREERS_LLM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1').replace(
      /\/$/,
      '',
    )
    return {
      model: env.CAREERS_LLM_MODEL?.trim() || NVIDIA_DEFAULT_MODEL,
      provider: 'nvidia',
      baseUrl,
    }
  }

  const openaiKey = env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    return {
      model: env.OPENAI_CAREERS_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
    }
  }

  return null
}

/** Public model label for CPU tooltip (no secrets). */
export function getOrganizeModelInfo(env = process.env) {
  const llm = resolveOrganizeLlmConfig(env)
  if (llm) {
    return {
      modelLabel: formatOrganizeModelLabel(llm.model, llm.provider),
      provider: llm.provider,
      configured: true,
    }
  }

  const preferredModel = env.CAREERS_LLM_MODEL?.trim() || NVIDIA_DEFAULT_MODEL
  return {
    modelLabel: formatOrganizeModelLabel(preferredModel, 'nvidia'),
    provider: null,
    configured: false,
  }
}
