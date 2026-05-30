function upstreamBase() {
  return process.env.REPORT_API_URL?.replace(/\/$/, '') ?? null
}

export default async function handler(_req, res) {
  const base = upstreamBase()
  if (!base) {
    res.status(503).json({
      ok: false,
      service: 'report-pdf',
      detail: 'REPORT_API_URL is not configured on Vercel.',
    })
    return
  }

  try {
    const upstream = await fetch(`${base}/health`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AXIOM-SeismicReport/1.0 (vercel-proxy)' },
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    res.status(502).json({
      ok: false,
      service: 'report-pdf',
      detail: `Health check failed: ${err?.message ?? String(err)}`,
    })
  }
}
