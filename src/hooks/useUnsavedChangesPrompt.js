import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warn when navigating away with in-progress state.
 * - Blocks in-app navigation (React Router) with a confirm dialog.
 * - Warns on tab close / refresh via beforeunload.
 */
export default function useUnsavedChangesPrompt(when, message) {
  const blocker = useBlocker(when)

  useEffect(() => {
    if (!when) return undefined

    const onBeforeUnload = event => {
      // Most browsers ignore custom text; setting returnValue triggers the prompt.
      event.preventDefault()
      // eslint-disable-next-line no-param-reassign
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined

    const ok = window.confirm(message)
    if (ok) blocker.proceed()
    else blocker.reset()
  }, [blocker, message])
}

