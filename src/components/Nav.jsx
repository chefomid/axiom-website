import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../constants/routes'

const linkClass =
  'hover:text-white transition-colors duration-300'

export default function Nav() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6">
      <Link to="/" className="font-display font-semibold text-sm tracking-[0.2em] text-white">
        AXIOM
      </Link>
      <nav className="flex gap-8 text-xs tracking-widest text-ink-muted uppercase">
        <Link
          to="/a-better-world"
          className={`${linkClass} ${pathname === '/a-better-world' ? 'text-white' : ''}`}
        >
          A Better World
        </Link>
        <Link
          to={PUBLIC_DATA_COMMAND_PATH}
          className={`${linkClass} ${pathname === PUBLIC_DATA_COMMAND_PATH ? 'text-white' : ''}`}
        >
          {PUBLIC_DATA_COMMAND_LABEL}
        </Link>
        <Link
          to={PROPERTY_INTELLIGENCE_PATH}
          className={`${linkClass} ${pathname === PROPERTY_INTELLIGENCE_PATH ? 'text-white' : ''}`}
        >
          {PROPERTY_INTELLIGENCE_LABEL}
        </Link>
      </nav>
    </header>
  )
}
