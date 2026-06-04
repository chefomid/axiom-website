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
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 border-b border-[#141414]/80 bg-black/90 px-6 py-5 backdrop-blur-md sm:px-8 sm:py-6">
      <Link to="/" className="shrink-0 font-display font-semibold text-sm tracking-[0.2em] text-white">
        AXIOM
      </Link>
      <nav className="flex min-w-0 flex-1 justify-end gap-2 overflow-x-auto text-[9px] tracking-widest text-ink-muted uppercase sm:gap-8 sm:text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to={PUBLIC_DATA_COMMAND_PATH}
          className={`${linkClass} shrink-0 whitespace-nowrap ${pathname === PUBLIC_DATA_COMMAND_PATH ? 'text-white' : ''}`}
        >
          {PUBLIC_DATA_COMMAND_LABEL}
        </Link>
        <Link
          to={PROPERTY_INTELLIGENCE_PATH}
          className={`${linkClass} shrink-0 whitespace-nowrap ${pathname === PROPERTY_INTELLIGENCE_PATH ? 'text-white' : ''}`}
        >
          {PROPERTY_INTELLIGENCE_LABEL}
        </Link>
      </nav>
    </header>
  )
}
