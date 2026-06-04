import { useCallback, useRef, useState } from 'react'
import { FEED_RETRY_DELAY_MS } from '../utils/feedErrors'

export default function useFeedRetry() {
  const [retryAt, setRetryAt] = useState(null)
  const timerRef = useRef(null)

  const clearRetry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRetryAt(null)
  }, [])

  const scheduleRetry = useCallback(onRetry => {
    if (timerRef.current) return
    const at = Date.now() + FEED_RETRY_DELAY_MS
    setRetryAt(at)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setRetryAt(null)
      onRetry()
    }, FEED_RETRY_DELAY_MS)
  }, [])

  return { retryAt, scheduleRetry, clearRetry, timerRef }
}
