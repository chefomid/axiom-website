/**
 * Stripe Embedded Checkout appearance — matches AXIOM Property Intelligence palette.
 * @see https://docs.stripe.com/payments/checkout/customization
 */
export const STRIPE_EMBEDDED_APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#4a9eff',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorTextSecondary: '#6e6e6e',
    colorDanger: '#e05252',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '8px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid #d8d8d8',
      boxShadow: 'none',
    },
    '.Tab': {
      borderRadius: '8px',
    },
  },
}
