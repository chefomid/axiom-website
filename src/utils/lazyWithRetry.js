import { lazy } from 'react'

const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed/i

/**
 * Retry lazy imports after Vite HMR or dev-server restarts invalidate old chunk URLs.
 */
export function lazyWithRetry(factory, { retries = 3, delayMs = 800 } = {}) {
  const attempt = remaining =>
    factory().catch(error => {
      const message = error?.message ?? ''
      if (remaining > 0 && CHUNK_LOAD_ERROR.test(message)) {
        return new Promise(resolve => setTimeout(resolve, delayMs)).then(() => attempt(remaining - 1))
      }
      throw error
    })

  return lazy(() => attempt(retries))
}

export function isChunkLoadError(error) {
  return CHUNK_LOAD_ERROR.test(error?.message ?? '')
}
