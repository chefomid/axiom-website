import { Link } from 'react-router-dom'
import CareersFooterLink from './careers/CareersFooterLink'
import { COOKIE_POLICY_PATH, PRIVACY_POLICY_PATH } from '../constants/routes'
import { CONTACT_EMAIL } from '../constants/site'
import { openCookieSettings, openDoNotSellOrShare } from './cookie/CookieConsentManager'

const linkClass = 'text-xs text-ink-faint transition-colors hover:text-white'

export default function SiteFooter({ className = '' }) {
  return (
    <footer
      data-snap-section
      id="contact"
      className={`border-t border-[#141414] px-8 py-12 md:px-20 ${className}`.trim()}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-display text-xs tracking-[0.2em] text-ink-faint">AXIOM</span>
          <nav
            aria-label="Site footer"
            className="mt-4 flex flex-wrap gap-x-4 gap-y-2"
          >
            <Link to={PRIVACY_POLICY_PATH} className={linkClass}>
              Privacy Policy
            </Link>
            <Link to={COOKIE_POLICY_PATH} className={linkClass}>
              Cookie Policy
            </Link>
            <button type="button" onClick={() => openCookieSettings()} className={linkClass}>
              Cookie Settings
            </button>
            <button type="button" onClick={() => openDoNotSellOrShare()} className={linkClass}>
              Privacy Choices
            </button>
            <CareersFooterLink className={linkClass} />
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              {CONTACT_EMAIL}
            </a>
          </nav>
        </div>
        <span className="text-xs text-ink-faint">© 2026</span>
      </div>
    </footer>
  )
}
