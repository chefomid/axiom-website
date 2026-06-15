import { Link, useLocation } from 'react-router-dom'

import {
  PROPERTY_INTELLIGENCE_LABEL,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../../constants/routes'

import { FAIR_USAGE_FOOTER } from '../ui/SafetyLimitNotice'
import CreditsWallet from './CreditsWallet'

const navLinkClass =
  'text-xs tracking-widest uppercase text-ink-muted transition-colors duration-300 hover:text-white'

export default function PropertyHeader({ apiOnline }) {
  const { pathname } = useLocation()

  return (
    <header className="shrink-0 border-b border-panel-border bg-[#060606]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-2 md:px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
            <Link
              to="/"
              className="shrink-0 font-display text-[10px] tracking-[0.18em] text-ink-faint transition-colors hover:text-white"
            >
              AXIOM
            </Link>
            <span className="hidden text-[10px] text-ink-faint/35 sm:inline" aria-hidden>
              /
            </span>
            <p className="min-w-0 font-display text-xs font-semibold uppercase tracking-[0.06em] text-white md:text-sm">
              {PROPERTY_INTELLIGENCE_LABEL}
            </p>
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {apiOnline ? <CreditsWallet apiOnline={apiOnline} align="left" compact /> : null}
            {apiOnline ? (
              <span className="hidden text-[8px] text-ink-faint/50 sm:inline" aria-hidden>
                ·
              </span>
            ) : null}
            <p className="hidden font-mono text-[8px] uppercase tracking-[0.14em] text-ink-muted sm:inline">
              Property dossiers · map workflow
            </p>
          </div>

          <p className="mt-0.5 hidden font-mono text-[7px] leading-snug text-ink-faint xl:block">
            {FAIR_USAGE_FOOTER}
          </p>
        </div>

        <nav className="flex shrink-0 items-center gap-4 md:gap-6">
          <Link
            to={PUBLIC_DATA_COMMAND_PATH}
            className={`${navLinkClass} hidden sm:inline ${
              pathname === PUBLIC_DATA_COMMAND_PATH ? 'text-white' : ''
            }`}
          >
            {PUBLIC_DATA_COMMAND_LABEL}
          </Link>
        </nav>
      </div>
    </header>
  )
}
