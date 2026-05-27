import { useEffect } from 'react'
import PublicDataCommandView from '../components/better-world/PublicDataCommandView'

export default function PublicDataCommand() {
  useEffect(() => {
    document.title = 'Public Data Command — AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  return <PublicDataCommandView />
}
