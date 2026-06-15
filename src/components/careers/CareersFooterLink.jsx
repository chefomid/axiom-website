import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CAREERS_ADMIN_PATH, CAREERS_LABEL, CAREERS_PATH } from '../../constants/routes'

export default function CareersFooterLink({ className }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const navigate = useNavigate()

  function handleContextMenu(event) {
    if (!import.meta.env.PROD) return
    event.preventDefault()
    setMenuPos({ x: event.clientX, y: event.clientY })
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    function close() {
      setMenuOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <>
      <Link to={CAREERS_PATH} className={className} onContextMenu={handleContextMenu}>
        {CAREERS_LABEL}
      </Link>
      {menuOpen ? (
        <div
          role="menu"
          className="fixed z-[200] min-w-[8rem] rounded-lg border border-panel-border bg-[#111] py-1 shadow-lg"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2 text-left text-xs text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
            onClick={() => {
              setMenuOpen(false)
              navigate(CAREERS_ADMIN_PATH)
            }}
          >
            Admin
          </button>
        </div>
      ) : null}
    </>
  )
}
