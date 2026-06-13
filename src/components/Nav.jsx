import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CAREERS_LABEL,
  CAREERS_PATH,
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../constants/routes'

const linkClass =
  'hover:text-white transition-colors duration-300'

const navLinks = [
  { to: PUBLIC_DATA_COMMAND_PATH, label: PUBLIC_DATA_COMMAND_LABEL, short: 'PDC' },
  { to: PROPERTY_INTELLIGENCE_PATH, label: PROPERTY_INTELLIGENCE_LABEL, short: 'Property Intel' },
  { to: CAREERS_PATH, label: CAREERS_LABEL, short: CAREERS_LABEL },
]

function NavLink({ to, label, pathname, className = linkClass, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${className} ${pathname === to ? 'text-white' : ''}`}
    >
      {label}
    </Link>
  )
}

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = e => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#141414]/80 bg-black/90 backdrop-blur-md"
      style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-4 px-6 pb-5 sm:px-8 sm:pb-6">
        <Link to="/" className="shrink-0 font-display font-semibold text-sm tracking-[0.2em] text-white">
          AXIOM
        </Link>

        <nav
          aria-label="Main"
          className="hidden min-w-0 flex-1 justify-end gap-8 text-xs tracking-widest text-ink-muted uppercase md:flex"
        >
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              label={link.label}
              pathname={pathname}
              className={`${linkClass} shrink-0 whitespace-nowrap`}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:hidden">
          <nav
            aria-label="Main compact"
            className="flex items-center gap-3 text-[9px] tracking-widest text-ink-muted uppercase"
          >
            {navLinks.slice(0, 2).map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                label={link.short}
                pathname={pathname}
                className={`${linkClass} shrink-0 whitespace-nowrap`}
              />
            ))}
          </nav>
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#2a2a2a] text-white transition-colors hover:border-[#444] hover:bg-[#141414]"
          >
            <span className="sr-only">{menuOpen ? 'Close' : 'Menu'}</span>
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={closeMenu}
          />
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile"
            className="absolute left-0 right-0 top-full z-50 max-h-[calc(100dvh-var(--safe-top)-4rem)] overflow-y-auto border-b border-[#141414] bg-[#0a0a0a]/98 px-6 py-6 backdrop-blur-md md:hidden safe-bottom-bar"
          >
            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  to="/"
                  onClick={closeMenu}
                  className={`block rounded px-3 py-3 font-display text-sm tracking-wide transition-colors hover:bg-[#141414] ${
                    pathname === '/' ? 'text-white' : 'text-ink-muted'
                  }`}
                >
                  Home
                </Link>
              </li>
              {navLinks.map(link => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={closeMenu}
                    className={`block rounded px-3 py-3 font-display text-sm tracking-wide transition-colors hover:bg-[#141414] ${
                      pathname === link.to ? 'text-white' : 'text-ink-muted'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </header>
  )
}
