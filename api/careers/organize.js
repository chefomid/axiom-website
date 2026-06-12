/**
 * Careers application — polish dictated or rough text with a lightweight LLM pass.
 *
 * Env (first match wins):
 *   NVIDIA_API_KEY — free dev tier via build.nvidia.com (recommended)
 *   CAREERS_LLM_BASE_URL — default https://integrate.api.nvidia.com/v1
 *   CAREERS_LLM_MODEL — default nvidia/nemotron-mini-4b-instruct
 *   OPENAI_API_KEY — optional fallback
 *   OPENAI_CAREERS_MODEL — default gpt-4o-mini
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '32kb',
    },
  },
}

const SYSTEM_PROMPT = `You rewrite rough dictated job application answers into clear prose.
Preserve the applicant's meaning, facts, and first-person voice. Do not invent experience or details.
Output ONLY the polished answer — no introductions, no labels, no "Here is...", no commentary about what you did.`

const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-mini-4b-instruct'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

const PREAMBLE_PATTERNS = [
  /^here(?:'s| is) the rewritten answer[^:]*:\s*/i,
  /^here(?:'s| is) a (?:clearer|more (?:positive|clear))[^:]*:\s*/i,
  /^sure,[^\n]*\n+/i,
  /^i(?:'d| would) be happy[^\n]*\n+/i,
  /^the rewritten (?:version|answer)[^:]*:\s*/i,
]

function cleanOrganizedText(text) {
  let out = String(text ?? '').trim()
  for (const pattern of PREAMBLE_PATTERNS) {
    out = out.replace(pattern, '')
  }
  const quoted = out.match(/^[“"](.+)[”"]$/s)
  if (quoted) out = quoted[1].trim()
  return out.trim()
}

function resolveLlmConfig() {
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim()
  if (nvidiaKey) {
    const baseUrl = (process.env.CAREERS_LLM_BASE_URL ?? NVIDIA_DEFAULT_BASE_URL).replace(/\/$/, '')
    return {
      apiKey: nvidiaKey,
      baseUrl,
      model: process.env.CAREERS_LLM_MODEL?.trim() || NVIDIA_DEFAULT_MODEL,
      provider: 'nvidia',
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: 'https://api.openai.com/v1',
      model: process.env.OPENAI_CAREERS_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
      provider: 'openai',
    }
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''

  if (!text) {
    res.status(400).json({ detail: 'Nothing to organize.' })
    return
  }

  const llm = resolveLlmConfig()
  if (!llm) {
    res.status(503).json({
      detail:
        'Thought organization is not configured. Set NVIDIA_API_KEY (free at build.nvidia.com) or OPENAI_API_KEY in project settings.',
    })
    return
  }

  const userContent = question
    ? `Application question: ${question}\n\nApplicant's raw answer:\n${text}`
    : `Applicant's raw answer:\n${text}`

  try {
    const upstream = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.2,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error(`Careers organize failed (${llm.provider}, ${upstream.status}): ${detail}`)
      res.status(502).json({ detail: 'Could not organize thoughts right now. Try again in a moment.' })
      return
    }

    const data = await upstream.json()
    const organized = cleanOrganizedText(data?.choices?.[0]?.message?.content)
    if (!organized) {
      res.status(502).json({ detail: 'No organized text was returned. Try again.' })
      return
    }

    res.status(200).json({ text: organized })
  } catch (err) {
    console.error(`Careers organize error (${llm.provider}): ${err?.message ?? err}`)
    res.status(502).json({ detail: 'Could not organize thoughts right now. Try again in a moment.' })
  }
}
