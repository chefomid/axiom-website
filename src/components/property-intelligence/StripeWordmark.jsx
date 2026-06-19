export default function StripeWordmark({ className = 'h-[14px] w-auto text-white' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 25"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Stripe"
      role="img"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M59.64 14.28h-8.06c0-1.66-1.09-2.88-2.72-2.88-1.77 0-2.98 1.25-2.98 3.12 0 1.83 1.18 3.1 2.98 3.1 1.63 0 2.72-1.15 2.72-2.34zm-11.05-5.18c-1.77 0-2.94 1.04-3.48 2.46l-.26-2.15h-3.9v15.9h4.52V12.5c0-1.17.86-1.93 2.18-1.93 1.18 0 1.88.68 1.88 1.77v8.82h4.52v-9.07c0-2.82-1.79-4.79-4.94-4.79zm-13.85 0c-3.11 0-5.33 2.39-5.33 5.66 0 3.24 2.14 5.59 5.4 5.59 1.77 0 3.14-.72 4.06-1.95l-2.38-1.66c-.52.68-1.22 1.05-2.03 1.05-1.22 0-2.18-.82-2.42-2.18h7.12c.03-.35.05-.7.05-1.05 0-3.27-2.19-5.66-5.47-5.66zm-2.38 4.61c.22-1.13 1.05-1.88 2.2-1.88 1.09 0 1.9.72 2.11 1.88h-4.31zM22.88 9.1c-1.77 0-2.94 1.04-3.48 2.46l-.26-2.15H15.24v15.9h4.52V12.5c0-1.17.86-1.93 2.18-1.93 1.18 0 1.88.68 1.88 1.77v8.82h4.52v-9.07C28.34 11.84 26.55 9.1 22.88 9.1zM8.9 5.05C4.06 5.05.99 7.68.99 11.59c0 3.86 2.59 5.97 6.72 5.97 2.59 0 4.52-.59 5.76-1.42V12.5c-1.13.75-2.66 1.22-4.57 1.22-1.81 0-2.86-.58-3.21-1.65H8.86c.03.12.05.24.05.36 0 1.48-1.22 2.52-3.01 2.52-2.02 0-3.34-1.57-3.34-4.05 0-2.54 1.35-4.15 3.42-4.15 1.05 0 1.88.35 2.4.92l2.07-1.87C12.62 5.68 10.85 5.05 8.9 5.05z"
      />
    </svg>
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
      className={`mt-3 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white ${className}`.trim()}
    >
      <CheckoutShieldIcon />
      <span>Secured by</span>
      <StripeWordmark />
    </p>
  )
}
