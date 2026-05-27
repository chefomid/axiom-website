import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav'
import VisionTab from '../components/better-world/VisionTab'
import { PUBLIC_DATA_COMMAND_PATH } from '../constants/routes'

export default function BetterWorld() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const view = searchParams.get('view')
  if (view === 'impact' || view === 'command') {
    return <Navigate to={PUBLIC_DATA_COMMAND_PATH} replace />
  }

  return (
    <div className="min-h-screen bg-black text-ink-primary font-sans">
      <Nav />
      <VisionTab />
    </div>
  )
}
