import { useCallback, useState } from 'react'

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
}

export default function useGeolocation(options = DEFAULT_OPTIONS) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const clearError = useCallback(() => setError(''), [])

  const requestPosition = useCallback(async () => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported in this browser.'
      setError(msg)
      throw new Error(msg)
    }

    setError('')
    setLocating(true)

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          reject,
          { ...DEFAULT_OPTIONS, ...options },
        )
      })
      return pos
    } catch (err) {
      const msg =
        err?.code === 1
          ? 'Location access denied. Allow location in your browser settings and try again.'
          : err?.code === 3
            ? 'Location request timed out. Check your connection and try again.'
            : 'Unable to access your location. Allow browser location access and try again.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLocating(false)
    }
  }, [options])

  return { locating, error, clearError, requestPosition, setError }
}
