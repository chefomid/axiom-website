import organizeHandler from '../api/careers/organize.js'
import organizeInfoHandler from '../api/careers/organize/info.js'
import applyHandler from '../api/careers/apply.js'
import adminSubmissionsHandler from '../api/careers/admin/submissions.js'
import adminSubmissionHandler from '../api/careers/admin/submission.js'
import adminExportHandler from '../api/careers/admin/export.js'
import adminResumeHandler from '../api/careers/admin/resume.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function createMockRes(nodeRes) {
  let statusCode = 200
  const headers = {}

  return {
    status(code) {
      statusCode = code
      return this
    },
    setHeader(name, value) {
      headers[name] = value
      return this
    },
    json(payload) {
      nodeRes.statusCode = statusCode
      for (const [name, value] of Object.entries(headers)) {
        nodeRes.setHeader(name, value)
      }
      nodeRes.setHeader('Content-Type', 'application/json')
      nodeRes.end(JSON.stringify(payload))
    },
    send(payload) {
      nodeRes.statusCode = statusCode
      for (const [name, value] of Object.entries(headers)) {
        nodeRes.setHeader(name, value)
      }
      nodeRes.end(payload)
    },
    end(payload) {
      nodeRes.statusCode = statusCode
      for (const [name, value] of Object.entries(headers)) {
        nodeRes.setHeader(name, value)
      }
      nodeRes.end(payload)
    },
  }
}

const GET_ROUTES = {
  '/api/careers/organize/info': organizeInfoHandler,
}

const POST_ROUTES = {
  '/api/careers/organize': organizeHandler,
  '/api/careers/apply': applyHandler,
}

const ADMIN_ROUTES = {
  '/api/careers/admin/submissions': adminSubmissionsHandler,
  '/api/careers/admin/submission': adminSubmissionHandler,
  '/api/careers/admin/export': adminExportHandler,
  '/api/careers/admin/resume': adminResumeHandler,
}

/** Serve Vercel careers API routes during Vite dev. */
export function careersApiDevPlugin() {
  return {
    name: 'careers-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        const isPost = req.method === 'POST'
        const isGet = req.method === 'GET'
        const isPatch = req.method === 'PATCH'

        const postHandler = isPost ? POST_ROUTES[path] : null
        const getHandler = isGet ? GET_ROUTES[path] : null
        const adminHandler = ADMIN_ROUTES[path]

        if (!postHandler && !getHandler && !adminHandler) {
          next()
          return
        }

        if (adminHandler && !(isGet || isPatch)) {
          next()
          return
        }

        if (getHandler && !isGet) {
          next()
          return
        }

        if (postHandler && !isPost) {
          next()
          return
        }

        try {
          const body = isPost || isPatch ? await readBody(req) : {}
          const handler = postHandler ?? getHandler ?? adminHandler
          await handler(
            {
              method: req.method,
              body,
              url: req.url,
              headers: req.headers,
            },
            createMockRes(res),
          )
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
