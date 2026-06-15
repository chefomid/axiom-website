import { Suspense, useCallback, useEffect, useState } from 'react'
import PropertyIntelligenceIntroModal, {
  ackPropertyIntelligenceIntro,
  isPropertyIntelligenceIntroAcked,
} from '../components/property-intelligence/PropertyIntelligenceIntroModal'
import PropertyIntelligenceOverview from '../components/property-intelligence/PropertyIntelligenceOverview'
import { isPropertyIntelligenceEnabled } from '../config/features'
import { useIsLgUp } from '../hooks/useMediaQuery'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import { CheckoutPayProvider } from '../hooks/useCheckoutPay'

const PropertyIntelligenceView = lazyWithRetry(
  () => import('../components/property-intelligence/PropertyIntelligenceView'),
)

export default function PropertyIntelligence() {
  const enabled = isPropertyIntelligenceEnabled()
  const isLgUp = useIsLgUp()
  const [introOpen, setIntroOpen] = useState(() => !isPropertyIntelligenceIntroAcked())

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

