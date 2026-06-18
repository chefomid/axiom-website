import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PropertyIntelligenceIntroModal, {
  ackPropertyIntelligenceIntro,
  isPropertyIntelligenceIntroAcked,
} from '../components/property-intelligence/PropertyIntelligenceIntroModal'
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
  const [introOpen, setIntroOpen] = useState(() => !isPropertyIntelligenceIntroAcked())

  const isPaymentReturn =
    searchParams.get('billing') === 'success' && Boolean(searchParams.get('session_id')?.trim())

  const handleIntroContinue = useCallback(() => {
    ackPropertyIntelligenceIntro()
    setIntroOpen(false)
  }, [])

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

  if (!enabled || !isLgUp) {
    return <PropertyIntelligenceOverview comingSoon={!enabled} />
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-ink-primary">
      <PropertyIntelligenceIntroModal open={introOpen} onContinue={handleIntroContinue} />
      <Suspense fallback={null}>
        <CheckoutPayProvider>
          <PropertyIntelligenceView />
        </CheckoutPayProvider>
      </Suspense>
    </div>
  )
}
