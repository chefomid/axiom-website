import { Link, useLocation } from 'react-router-dom'
import {
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../../constants/routes'
import StatusChip from './StatusChip'

const navLinkClass =
  'text-xs tracking-widest uppercase text-ink-muted transition-colors duration-300 hover:text-white'

export default function CommandHeader() {
  const { pathname } = useLocation()

  return (
    <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <Link to="/" className="font-display text-xs tracking-[0.2em] text-ink-faint transition-colors hover:text-white">
            AXIOM
          </Link>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white md:text-base">
            Public Data Command
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Government & Open-Data Intelligence
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-6 md:gap-8">
          <Link
            to="/a-better-world"
            className={`${navLinkClass} ${pathname === '/a-better-world' ? 'text-white' : ''}`}
          >
            A Better World
          </Link>
          <Link
            to={PUBLIC_DATA_COMMAND_PATH}
            className={`${navLinkClass} ${pathname === PUBLIC_DATA_COMMAND_PATH ? 'text-white' : ''}`}
          >
            {PUBLIC_DATA_COMMAND_LABEL}
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-panel-border px-4 py-2 md:px-6">
        <StatusChip label="System Status: Active" status="stable" pulse />
        <StatusChip label="Data Sync: Live" status="live" pulse />
        <StatusChip label="Scope: Open Data" status="live" />
      </div>
    </header>
  )
}
