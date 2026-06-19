import { STRIPE_WORDMARK_WHITE_SRC } from '../../constants/site'

export default function StripeWordmark({ className = 'h-4 w-auto' }) {
  return (
    <img
      src={STRIPE_WORDMARK_WHITE_SRC}
      alt="Stripe"
      width={60}
      height={25}
      className={className}
      decoding="async"
      draggable={false}
    />
  )
}

function CheckoutShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0 text-white">
      <path
        d="M6 1L1 3.5v2.5c0 2.75 2.15 5.32 5 5.95 2.85-.63 5-3.2 5-5.95V3.5L6 1z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SecuredByStripeBadge({ className = '' }) {
  return (
    <p
      className={`mt-3 flex items-center justify-center gap-2.5 font-sans text-[11px] text-white ${className}`.trim()}
    >
      <CheckoutShieldIcon />
      <span>Secured by</span>
      <StripeWordmark className="h-[15px] w-auto translate-y-[0.5px]" />
    </p>
  )
}
