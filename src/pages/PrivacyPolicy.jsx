import LegalPageLayout from '../components/LegalPageLayout'
import { COOKIE_POLICY_PATH } from '../constants/routes'
import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        <strong>Last updated:</strong> June 8, 2026
      </p>
      <p>
        This Privacy Policy describes how AXIOM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
        collects, uses, and shares information when you visit our website and use our products,
        including Public Data Command and Property Intelligence.
      </p>

      <section>
        <h2 className="font-display text-lg text-white">Information we collect</h2>
        <p className="mt-2">We collect information in the following ways:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Information you provide:</strong> Addresses you search, report configurations,
            and payment-related identifiers when you purchase credit packs through Stripe Checkout.
          </li>
          <li>
            <strong>Automatically collected technical data:</strong> Browser type, device
            information, pages visited, and referral source, only when you consent to analytics
            (Plausible Analytics).
          </li>
          <li>
            <strong>Local storage identifiers:</strong> An anonymous wallet ID for Property
            Intelligence billing demos, UI preference flags, and hazard feed caches stored in your
            browser.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">How we use information</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Operate and secure the website (necessary cookies and storage)</li>
          <li>Deliver property enrichment reports and hazard map features you request</li>
          <li>Process payments through Stripe when billing is enabled</li>
          <li>Understand aggregate site usage to improve content and performance (analytics, with consent)</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Third-party services</h2>
        <p className="mt-2">We use the following categories of third-party services:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Payment processing:</strong> Stripe (when billing is enabled). Stripe&apos;s
            privacy policy governs payment data.
          </li>
          <li>
            <strong>Analytics:</strong> Plausible Analytics (cookieless, EU-hosted), loaded only
            with your consent.
          </li>
          <li>
            <strong>Maps and imagery:</strong> MapLibre, CARTO, Esri, and optionally Google Maps
            for Street View when an API key is configured.
          </li>
          <li>
            <strong>Government and open data APIs:</strong> USGS, NWS, FEMA, NASA, EPA, and
            similar public sources for hazard feeds.
          </li>
          <li>
            <strong>Property data vendors:</strong> ATTOM, Melissa, RentCast, First Street, and
            others when you run Property Intelligence enrichments.
          </li>
          <li>
            <strong>Typography:</strong> Google Fonts (loaded from Google servers).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Your choices</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            Manage cookie and tracking preferences through <strong>Cookie Settings</strong> in the
            site footer.
          </li>
          <li>
            AXIOM does not sell your personal information. California residents can manage
            marketing-related preferences via <strong>Privacy Choices</strong> in the site footer or
            Cookie Settings.
          </li>
          <li>
            We honor the Global Privacy Control (GPC) signal where applicable.
          </li>
        </ul>
        <p className="mt-2">
          See our <Link to={COOKIE_POLICY_PATH} className="text-command-live hover:underline">Cookie Policy</Link>{' '}
          for a detailed list of cookies and similar technologies.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Data retention</h2>
        <p className="mt-2">
          Consent records are stored locally in your browser until you clear site data or change
          your preferences. Property report sessions and billing records are retained per our
          operational needs and applicable law.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-white">Contact</h2>
        <p className="mt-2">
          For privacy questions, contact us through the information on our website. This is a draft
          template and should be reviewed by qualified legal counsel before relying on it for
          compliance purposes.
        </p>
      </section>
    </LegalPageLayout>
  )
}
