import LegalPageLayout from '../components/LegalPageLayout'
import { PRIVACY_POLICY_PATH } from '../constants/routes'
import { Link } from 'react-router-dom'

const COOKIE_TABLE = [
  {
    name: 'axiom:cookie-consent',
    provider: 'AXIOM (first-party)',
    purpose: 'Stores your cookie and privacy consent choices',
    category: 'Necessary',
    duration: 'Until cleared or policy version changes',
    type: 'localStorage',
  },
  {
    name: 'axiom:property-intelligence:anon-id',
    provider: 'AXIOM (first-party)',
    purpose: 'Anonymous wallet identifier for Property Intelligence billing',
    category: 'Necessary / Functional',
    duration: 'Persistent until cleared',
    type: 'localStorage',
  },
  {
    name: 'axiom:pi-intro-ack',
    provider: 'AXIOM (first-party)',
    purpose: 'Remembers Property Intelligence onboarding dismissal',
    category: 'Functional',
    duration: 'Browser session',
    type: 'sessionStorage',
  },
  {
    name: 'axiom:pdc-intro-ack',
    provider: 'AXIOM (first-party)',
    purpose: 'Remembers Public Data Command disclaimer acknowledgment',
    category: 'Functional',
    duration: 'Browser session',
    type: 'sessionStorage',
  },
  {
    name: 'axiom:property-intelligence:report-state',
    provider: 'AXIOM (first-party)',
    purpose: 'Preserves in-progress property report draft',
    category: 'Functional',
    duration: 'Browser session',
    type: 'sessionStorage',
  },
  {
    name: 'axiom-risk-cache:*',
    provider: 'AXIOM (first-party)',
    purpose: 'Caches hazard feed responses to reduce API load',
    category: 'Functional',
    duration: 'Browser session',
    type: 'sessionStorage',
  },
  {
    name: 'axiom-command-scope-configured',
    provider: 'AXIOM (first-party)',
    purpose: 'Remembers map scope configuration in Public Data Command',
    category: 'Functional',
    duration: 'Browser session',
    type: 'sessionStorage',
  },
  {
    name: 'Plausible Analytics script',
    provider: 'Plausible Insights OÜ (third-party)',
    purpose: 'Aggregate pageview and referral statistics, no cookies, no personal data',
    category: 'Analytics (consent required)',
    duration: 'N/A (cookieless)',
    type: 'Script (loaded on consent)',
  },
]

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy">
      <p>
        <strong>Last updated:</strong> June 8, 2026
      </p>
      <p>
        This Cookie Policy explains how AXIOM uses cookies and similar technologies (such as
        localStorage and sessionStorage) on our website. For broader data practices, see our{' '}
        <Link to={PRIVACY_POLICY_PATH} className="text-command-live hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <section>
        <h2 className="font-display text-lg text-white">What are cookies?</h2>
        <p className="mt-2">
          Cookies are small text files stored on your device. We also use browser storage APIs
          (localStorage and sessionStorage) for similar purposes. Some are essential for the site to
          function; others help us understand usage or support optional features.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Cookie categories</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Necessary:</strong> Required for security, consent records, and core
            functionality. Cannot be disabled.
          </li>
          <li>
            <strong>Functional:</strong> Remember UI preferences, onboarding acknowledgments, and
            cache public data feeds for performance.
          </li>
          <li>
            <strong>Analytics:</strong> Plausible Analytics, loaded only after you consent. Does
            not use cookies or track individuals.
          </li>
          <li>
            <strong>Marketing:</strong> Not currently in use. Reserved for future ad measurement or
            retargeting tools, which would require consent.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Technologies in use</h2>
        <div className="mt-3 overflow-x-auto rounded border border-[#2a2a2a]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#2a2a2a] bg-[#0a0a0a] font-mono uppercase tracking-wider text-ink-muted">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {COOKIE_TABLE.map(row => (
                <tr key={row.name} className="border-b border-[#1a1a1a] text-ink-secondary">
                  <td className="px-3 py-2 font-mono text-[11px] text-white">{row.name}</td>
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2">{row.purpose}</td>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">{row.duration}</td>
                  <td className="px-3 py-2">{row.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Third-party resources</h2>
        <p className="mt-2">
          The following third-party resources may load when you use certain features, regardless of
          analytics consent:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Google Fonts (typography)</li>
          <li>Map tile providers (CARTO, Esri) when viewing maps</li>
          <li>Google Maps embed when Street View is enabled and an API key is configured</li>
          <li>Stripe Checkout when purchasing credit packs</li>
          <li>Government and open-data APIs for hazard feeds</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Managing your preferences</h2>
        <p className="mt-2">
          Use <strong>Cookie Settings</strong> in the site footer to accept, reject, or customize
          non-essential cookies and analytics. You can withdraw consent at any time with the same
          ease as giving it.
        </p>
        <p className="mt-2">
          AXIOM does not sell your personal information. California residents can use{' '}
          <strong>Privacy Choices</strong> in the footer to turn off marketing-related preferences.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Disclaimer</h2>
        <p className="mt-2">
          This is a draft engineering template based on current site behavior. It is not legal
          advice and should be reviewed by qualified counsel before publication.
        </p>
      </section>
    </LegalPageLayout>
  )
}
