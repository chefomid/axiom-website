import organizeHandler from '../api/careers/organize.js'
import applyHandler from '../api/careers/apply.js'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function createMockRes(nodeRes) {
  let statusCode = 200
  return {
    status(code) {
      statusCode = code
      return this
    },
    json(payload) {
      nodeRes.statusCode = statusCode
      nodeRes.setHeader('Content-Type', 'application/json')
      nodeRes.end(JSON.stringify(payload))
    },
  }
}

const ROUTES = {
  '/api/careers/organize': organizeHandler,
  '/api/careers/apply': applyHandler,
}

/** Serve Vercel careers API routes during Vite dev. */
export function careersApiDevPlugin() {
  return {
    name: 'careers-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        const path = req.url?.split('?')[0] ?? ''
        const handler = ROUTES[path]
        if (!handler) {
          next()
          return
        }

        try {
          const body = await readJsonBody(req)
          await handler({ method: 'POST', body }, createMockRes(res))
        } catch (err) {
          console.error(`[careers-api-dev] ${path}:`, err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ detail: 'Dev API error.' }))
        }
      })
    },
  }
}
