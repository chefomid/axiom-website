import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CAREERS_LABEL,
  CAREERS_PATH,
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../constants/routes'

const linkClass = 'hover:text-white transition-colors duration-300'

const navLinks = [
  { to: PUBLIC_DATA_COMMAND_PATH, label: PUBLIC_DATA_COMMAND_LABEL, short: 'PDC' },
  { to: PROPERTY_INTELLIGENCE_PATH, label: PROPERTY_INTELLIGENCE_LABEL, short: 'Property Intel' },
  { to: CAREERS_PATH, label: CAREERS_LABEL, short: CAREERS_LABEL },
]

const mobileMenuLinks = [
  {
    to: '/',
    label: 'Home',
    description: 'AXIOM overview and product showcase',
  },
  {
    to: PUBLIC_DATA_COMMAND_PATH,
    label: PUBLIC_DATA_COMMAND_LABEL,
    description: 'Live government hazard feeds and regional intelligence',
  },
  {
    to: PROPERTY_INTELLIGENCE_PATH,
    label: PROPERTY_INTELLIGENCE_LABEL,
    description: 'Address-level COPE enrichment and property dossiers',
  },
  {
    to: CAREERS_PATH,
    label: CAREERS_LABEL,
    description: 'Join the AXIOM / ATLAS development team',
  },
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

function MobileMenuPanel({ open, onClose, pathname }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] md:hidden"
        >
          <motion.nav
            id="mobile-nav-drawer"
            aria-label="Mobile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="safe-bottom-bar relative z-10 flex h-full flex-col bg-[#050505] px-6 pb-6 pt-[calc(var(--safe-top)+5.25rem)]"
          >
              <div className="flex items-center justify-between border-b border-[#222] pb-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-muted">Navigation</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#333] text-ink-muted transition-colors hover:border-[#555] hover:text-white"
                  aria-label="Close menu"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <ul className="mt-2 flex flex-1 flex-col">
                {mobileMenuLinks.map(link => {
                  const active = pathname === link.to
                  return (
                    <li key={link.to} className="border-b border-[#1a1a1a]">
                      <Link
                        to={link.to}
                        onClick={onClose}
                        className={`block py-4 transition-colors ${
                          active ? 'text-white' : 'text-ink-muted hover:text-white'
                        }`}
                      >
                        <span className="font-display text-base font-medium tracking-tight">{link.label}</span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-ink-faint">{link.description}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isHome = pathname === '/'

  useEffect(() => {
    window.scrollTo(0, 0)
    setHeaderHidden(false)
    lastScrollY.current = 0
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

  useEffect(() => {
    if (!isHome || menuOpen) {
      setHeaderHidden(false)
      return
    }

    const media = window.matchMedia('(max-width: 767px)')

    const onScroll = () => {
      if (!media.matches) {
        setHeaderHidden(false)
        return
      }

      const y = window.scrollY
      if (y <= 12) {
        setHeaderHidden(false)
      } else if (y > lastScrollY.current + 6 && y > 72) {
        setHeaderHidden(true)
      } else if (y < lastScrollY.current - 6) {
        setHeaderHidden(false)
      }
      lastScrollY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome, menuOpen])

  const closeMenu = () => setMenuOpen(false)

  const headerVisible = !headerHidden || menuOpen

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b border-[#141414]/80 bg-black/90 backdrop-blur-md transition-transform duration-300 ease-out will-change-transform md:translate-y-0 ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
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

          <div className="ml-auto flex items-center md:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(open => !open)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#2a2a2a] text-white transition-colors hover:border-[#444] hover:bg-[#141414]"
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
      </header>

      <MobileMenuPanel open={menuOpen} onClose={closeMenu} pathname={pathname} />
    </>
  )
}
