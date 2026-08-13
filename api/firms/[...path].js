/**
 * Same-origin NASA FIRMS proxy. The browser cannot call firms.modaps.eosdis.nasa.gov
 * (no CORS), and Vite's /api/firms rewrite does not exist on Vercel.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Allow', 'GET, HEAD').end()
    return
  }

  const prefix = '/api/firms'
  const rest = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url
  if (!rest.startsWith('/api/')) {
    res.status(400).send('Invalid FIRMS path')
    return
  }

  try {
    const upstream = await fetch(`https://firms.modaps.eosdis.nasa.gov${rest}`, {
      headers: { Accept: 'text/csv,text/plain' },
    })
    const body = await upstream.text()
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8')
    res.status(upstream.status).send(body)
  } catch {
    res.status(502).send('NASA FIRMS proxy failed')
  }
}
