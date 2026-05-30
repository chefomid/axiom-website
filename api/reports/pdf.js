export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

function upstreamBase() {
  return process.env.REPORT_API_URL?.replace(/\/$/, '') ?? null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Method not allowed' })
    return
  }

  const base = upstreamBase()
  if (!base) {
    res.status(503).json({
      detail:
        'PDF service is not configured. Deploy services/property-api to Render and set REPORT_API_URL on Vercel.',
    })
    return
  }

  try {
    const upstream = await fetch(`${base}/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
        'User-Agent': 'AXIOM-SeismicReport/1.0 (vercel-proxy)',
      },
      body: JSON.stringify(req.body),
    })

    const body = Buffer.from(await upstream.arrayBuffer())
    const contentType = upstream.headers.get('content-type') ?? 'application/json'

    if (!upstream.ok) {
      res.status(upstream.status).setHeader('Content-Type', contentType).send(body)
      return
    }

    res.setHeader('Content-Type', contentType)
    const disposition = upstream.headers.get('content-disposition')
    if (disposition) res.setHeader('Content-Disposition', disposition)
    res.status(200).send(body)
  } catch (err) {
    res.status(502).json({
      detail: `PDF proxy failed: ${err?.message ?? String(err)}`,
    })
  }
}
