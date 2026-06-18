import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import PropertyIntelligenceOverview from '../components/property-intelligence/PropertyIntelligenceOverview'
import MobilePaymentReturn from '../components/property-intelligence/MobilePaymentReturn'
import { isPropertyIntelligenceEnabled } from '../config/features'
import { prefetchPropertyCatalog } from '../services/propertyApi'
import { useIsLgUp } from '../hooks/useMediaQuery'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import { CheckoutPayProvider } from '../hooks/useCheckoutPay'

const PropertyIntelligenceView = lazyWithRetry(
  () => import('../components/property-intelligence/PropertyIntelligenceView'),
)

export default function PropertyIntelligence() {
  const enabled = isPropertyIntelligenceEnabled()
  const isLgUp = useIsLgUp()
  const [searchParams] = useSearchParams()

  const isPaymentReturn =
    searchParams.get('billing') === 'success' && Boolean(searchParams.get('session_id')?.trim())

  useEffect(() => {
    document.title = 'Property Intelligence | AXIOM'
    window.scrollTo(0, 0)
    return () => {
      document.title = 'AXIOM'
    }
  }, [])

  useEffect(() => {
    if (enabled && isLgUp) prefetchPropertyCatalog().catch(() => {})
  }, [enabled, isLgUp])

  if (!isLgUp && isPaymentReturn) {
    return <MobilePaymentReturn />
  }

  const showOverview = !enabled || !isLgUp

  return (
    <>
      {showOverview ? (
        <PropertyIntelligenceOverview comingSoon={!enabled} />
      ) : (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-ink-primary">
          <Suspense fallback={null}>
            <CheckoutPayProvider>
              <PropertyIntelligenceView />
            </CheckoutPayProvider>
          </Suspense>
        </div>
      )}
    </>
  )
}
