import { useEffect } from 'react'
import CareersView from '../components/careers/CareersView'

export default function Careers() {
  useEffect(() => {
    document.title = 'Careers | AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  return <CareersView />
}
