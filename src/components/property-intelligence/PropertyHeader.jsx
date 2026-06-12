import { Link, useLocation } from 'react-router-dom'

import {
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../../constants/routes'

import CreditsWallet from './CreditsWallet'

const navLinkClass =
  'text-xs tracking-widest uppercase text-ink-muted transition-colors duration-300 hover:text-white'

export default function PropertyHeader({ apiOnline }) {
  const { pathname } = useLocation()

  return (
    <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <Link
            to="/"
            className="font-display text-xs tracking-[0.2em] text-ink-faint transition-colors hover:text-white"
          >
            AXIOM
          </Link>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-white md:text-base">
            {PROPERTY_INTELLIGENCE_LABEL}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
            Property dossiers · map workflow
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-6 md:gap-8">
          <Link
            to={PUBLIC_DATA_COMMAND_PATH}
            className={`${navLinkClass} ${pathname === PUBLIC_DATA_COMMAND_PATH ? 'text-white' : ''}`}
          >
            {PUBLIC_DATA_COMMAND_LABEL}
          </Link>
          <Link
            to={PROPERTY_INTELLIGENCE_PATH}
            className={`${navLinkClass} ${pathname === PROPERTY_INTELLIGENCE_PATH ? 'text-white' : ''}`}
          >
            {PROPERTY_INTELLIGENCE_LABEL}
          </Link>
          {apiOnline ? <CreditsWallet apiOnline={apiOnline} /> : null}
        </nav>
      </div>
    </header>
  )
}
