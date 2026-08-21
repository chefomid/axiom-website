import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  EARTHQUAKE_ANALYSIS_LABEL,
  EARTHQUAKE_ANALYSIS_PATH,
  FIRE_ALERTS_DEMO_URL,
  FIRE_HOTSPOTS_LABEL,
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../constants/routes'
import { isFireAlertsDemoEnabled } from '../config/features'

const linkClass = 'hover:text-white transition-colors duration-300'
const dropdownEase = [0.25, 0.1, 0.25, 1]

const publicDataCommandItems = [
  {
    id: 'fire',
    label: FIRE_HOTSPOTS_LABEL,
    kind: 'external',
  },
  {
    id: 'seismic',
    label: EARTHQUAKE_ANALYSIS_LABEL,
    to: EARTHQUAKE_ANALYSIS_PATH,
    kind: 'internal',
  },
]

const subNavItemClass =
  'block py-0.5 text-left text-[9px] uppercase tracking-[0.16em] text-white/30 transition-colors duration-300 hover:text-white/55'

function pathActive(pathname, to) {
  return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`))
}

function publicDataCommandActive(pathname) {
  return (
    pathActive(pathname, PUBLIC_DATA_COMMAND_PATH) ||
    pathActive(pathname, EARTHQUAKE_ANALYSIS_PATH)
  )
}

function ChevronDown({ className = '' }) {
  return (
    <svg
      className={className}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavLink({ to, label, pathname, className = linkClass, onClick }) {
  const active = pathActive(pathname, to)
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${className} ${active ? 'text-white' : ''}`}
    >
      {label}
    </Link>
  )
}

function PublicDataCommandDropdown({ pathname, onNavigateFire }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const active = publicDataCommandActive(pathname)
  const fireEnabled = isFireAlertsDemoEnabled() && Boolean(FIRE_ALERTS_DEMO_URL)

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleFireSelect = () => {
    setOpen(false)
    onNavigateFire()
  }

  return (
    <div ref={rootRef} className="group relative shrink-0">
      <div className="relative flex flex-col items-start">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls="nav-pdc-menu"
          onClick={() => setOpen(value => !value)}
          className={`inline-flex items-center gap-1.5 uppercase tracking-widest transition-colors duration-300 ${
            active || open ? 'text-white' : 'text-ink-muted hover:text-white'
          }`}
        >
          <span>{PUBLIC_DATA_COMMAND_LABEL}</span>
          <ChevronDown
            className={`shrink-0 transition-all duration-300 ${
              open
                ? 'rotate-180 opacity-100'
                : 'opacity-0 group-hover:opacity-70 group-focus-within:opacity-70'
            }`}
          />
        </button>

        <AnimatePresence>
          {open ? (
            <motion.ul
              id="nav-pdc-menu"
              role="menu"
              aria-label={PUBLIC_DATA_COMMAND_LABEL}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.16, ease: dropdownEase }}
              className="absolute left-0 top-full z-[60] mt-1 flex flex-col items-start gap-0.5"
            >
              {publicDataCommandItems.map(item => {
                if (item.kind === 'external' && !fireEnabled) return null

                const itemActive =
                  item.kind === 'internal' && item.to ? pathActive(pathname, item.to) : false

                const rowClass = `${subNavItemClass} ${itemActive ? 'text-white/55' : ''}`

                if (item.kind === 'external') {
                  return (
                    <li key={item.id} role="none">
                      <button type="button" role="menuitem" onClick={handleFireSelect} className={rowClass}>
                        {item.label}
                      </button>
                    </li>
                  )
                }

                return (
                  <li key={item.id} role="none">
                    <Link
                      to={item.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={rowClass}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MobilePublicDataSection({ pathname, onClose, onNavigateFire }) {
  const [expanded, setExpanded] = useState(publicDataCommandActive(pathname))
  const fireEnabled = isFireAlertsDemoEnabled() && Boolean(FIRE_ALERTS_DEMO_URL)
  const active = publicDataCommandActive(pathname)

  return (
    <li className="border-b border-[#1a1a1a]">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-3 py-4 text-left transition-colors ${
          active ? 'text-white' : 'text-ink-muted hover:text-white'
        }`}
      >
        <span className="font-display text-base font-medium tracking-tight">
          {PUBLIC_DATA_COMMAND_LABEL}
        </span>
        <ChevronDown
          className={`shrink-0 text-ink-faint transition-transform duration-300 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: dropdownEase }}
            className="overflow-hidden pb-2"
          >
            {publicDataCommandItems.map(item => {
              if (item.kind === 'external' && !fireEnabled) return null

              const itemActive =
                item.kind === 'internal' && item.to ? pathActive(pathname, item.to) : false

              const rowClass = `${subNavItemClass} pl-0 ${itemActive ? 'text-white/55' : ''}`

              if (item.kind === 'external') {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onNavigateFire()
                      }}
                      className={rowClass}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              }

              return (
                <li key={item.id}>
                  <Link to={item.to} onClick={onClose} className={rowClass}>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

function MobileMenuPanel({ open, onClose, pathname, onNavigateFire }) {
  return (
    <AnimatePresence>
      {open ? (
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
            transition={{ duration: 0.3, ease: dropdownEase }}
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
              <li className="border-b border-[#1a1a1a]">
                <Link
                  to="/"
                  onClick={onClose}
                  className={`block py-4 transition-colors ${
                    pathActive(pathname, '/') ? 'text-white' : 'text-ink-muted hover:text-white'
                  }`}
                >
                  <span className="font-display text-base font-medium tracking-tight">Home</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-ink-faint">
                    AXIOM overview and product showcase
                  </span>
                </Link>
              </li>

              <MobilePublicDataSection
                pathname={pathname}
                onClose={onClose}
                onNavigateFire={onNavigateFire}
              />

              <li className="border-b border-[#1a1a1a]">
                <Link
                  to={PROPERTY_INTELLIGENCE_PATH}
                  onClick={onClose}
                  className={`block py-4 transition-colors ${
                    pathActive(pathname, PROPERTY_INTELLIGENCE_PATH)
                      ? 'text-white'
                      : 'text-ink-muted hover:text-white'
                  }`}
                >
                  <span className="font-display text-base font-medium tracking-tight">
                    {PROPERTY_INTELLIGENCE_LABEL}
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-ink-faint">
                    Address-level COPE enrichment and property dossiers
                  </span>
                </Link>
              </li>
            </ul>
          </motion.nav>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default function Nav() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)
  const isHome = pathname === '/'

  const navigateToFirePreview = useCallback(() => {
    if (!isFireAlertsDemoEnabled() || !FIRE_ALERTS_DEMO_URL) return
    window.location.assign(FIRE_ALERTS_DEMO_URL)
  }, [])

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
      return undefined
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
            className="hidden min-w-0 flex-1 items-center justify-end gap-8 text-xs text-ink-muted md:flex"
          >
            <PublicDataCommandDropdown pathname={pathname} onNavigateFire={navigateToFirePreview} />
            <NavLink
              to={PROPERTY_INTELLIGENCE_PATH}
              label={PROPERTY_INTELLIGENCE_LABEL}
              pathname={pathname}
              className={`${linkClass} shrink-0 whitespace-nowrap uppercase tracking-widest`}
            />
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

      <MobileMenuPanel
        open={menuOpen}
        onClose={closeMenu}
        pathname={pathname}
        onNavigateFire={navigateToFirePreview}
      />

    </>
  )
}
