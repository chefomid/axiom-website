import { loadStripe } from '@stripe/stripe-js'

let stripePromise = null
let cachedPublishableKey = ''

export function getStripePromise(publishableKey) {
  if (!publishableKey) return null
  if (cachedPublishableKey !== publishableKey) {
    cachedPublishableKey = publishableKey
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}
