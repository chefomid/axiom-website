import { useEffect } from 'react'
import PublicDataCommandView from '../components/better-world/PublicDataCommandView'
import PublicDataCommandBlockedModal from '../components/better-world/PublicDataCommandBlockedModal'
import { isPublicDataCommandEnabled } from '../config/features'

export default function PublicDataCommand() {
  const enabled = isPublicDataCommandEnabled()

  useEffect(() => {
    document.title = 'Public Data Command | AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  if (!enabled) {
    return <PublicDataCommandBlockedModal />
  }

  return <PublicDataCommandView />
}
