/**

 * Careers application, polish dictated or rough text with a lightweight LLM pass.

 *

 * Env (first match wins):

 *   NVIDIA_API_KEY, free dev tier via build.nvidia.com (recommended)

 *   CAREERS_LLM_BASE_URL, default https://integrate.api.nvidia.com/v1

 *   CAREERS_LLM_MODEL, default nvidia/nemotron-mini-4b-instruct

 *   OPENAI_API_KEY, optional fallback

 *   OPENAI_CAREERS_MODEL, default gpt-4o-mini

 */



import {
  isOrganizeExpansionAcceptable,
  lightOrganizeText,
  resolveOrganizeLlmConfig,
  shouldUseLlmOrganize,
} from './organizeUtils.js'
import { checkRateLimit } from '../lib/rateLimit.js'



export const config = {

  api: {

    bodyParser: {

      sizeLimit: '32kb',

    },

  },

}



const SYSTEM_PROMPT = `You organize job application answers. You are an editor, not a writer.



Rules:

- Use ONLY facts and phrases present in the applicant's raw answer.

- Do NOT invent experience, projects, clients, metrics, or motivations they did not mention.

- Do NOT answer the application question with new content. Only clean up what was already said.

- If the answer is short, vague, repetitive, or looks like a test phrase, return it with minimal edits: fix spacing, capitalization, and punctuation only. Do not expand it.

- Preserve first-person voice when the applicant used it.

- Output ONLY the organized answer. No introductions, labels, or commentary.`



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
  const llm = resolveOrganizeLlmConfig(process.env)
  if (!llm) return null
  const apiKey =
    llm.provider === 'nvidia'
      ? process.env.NVIDIA_API_KEY?.trim()
      : process.env.OPENAI_API_KEY?.trim()
  return { ...llm, apiKey }
}



export default async function handler(req, res) {

  if (req.method !== 'POST') {

    res.status(405).json({ detail: 'Method not allowed' })

    return

  }



  if (
    !checkRateLimit(req, res, {
      route: 'careers:organize',
      limit: 30,
      windowMs: 60 * 60 * 1000,
    })
  ) {
    return
  }



  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''



  if (!text) {

    res.status(400).json({ detail: 'Nothing to organize.' })

    return

  }



  if (!shouldUseLlmOrganize(text)) {

    res.status(200).json({ text: lightOrganizeText(text), mode: 'light' })

    return

  }



  const llm = resolveLlmConfig()

  if (!llm) {

    res.status(200).json({ text, mode: 'passthrough' })

    return

  }



  const userContent = question

    ? `Application question: ${question}\n\nApplicant's raw answer:\n${text}\n\nOrganize only what appears above. Do not add new substance.`

    : `Applicant's raw answer:\n${text}\n\nOrganize only what appears above. Do not add new substance.`



  try {

    const upstream = await fetch(`${llm.baseUrl}/chat/completions`, {

      method: 'POST',

      headers: {

        Authorization: `Bearer ${llm.apiKey}`,

        'Content-Type': 'application/json',

      },

      body: JSON.stringify({

        model: llm.model,

        temperature: 0.1,

        max_tokens: 512,

        messages: [

          { role: 'system', content: SYSTEM_PROMPT },

          { role: 'user', content: userContent },

        ],

      }),

    })



    if (!upstream.ok) {

      const detail = await upstream.text().catch(() => '')

      console.error(`Careers organize failed (${llm.provider}, ${upstream.status}): ${detail}`)

      res.status(200).json({ text: lightOrganizeText(text), mode: 'light' })

      return

    }



    const data = await upstream.json()

    const organized = cleanOrganizedText(data?.choices?.[0]?.message?.content)

    if (!organized || !isOrganizeExpansionAcceptable(text, organized)) {

      res.status(200).json({ text: lightOrganizeText(text), mode: 'light' })

      return

    }



    res.status(200).json({ text: organized, mode: 'llm' })

  } catch (err) {

    console.error(`Careers organize error (${llm.provider}): ${err?.message ?? err}`)

    res.status(200).json({ text: lightOrganizeText(text), mode: 'light' })

  }

}


