import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DossierMobileNav } from './dossier/DossierMobileNav'

const IM_NAV_SECTIONS = [
  { id: 0, label: 'Insurance Operations Workspace', shortLabel: 'Overview' },
  { id: 1, label: 'All Coverages in One View', shortLabel: 'Portfolio' },
  { id: 2, label: 'Detailed Exposure Views', shortLabel: 'Exposures' },
  { id: 3, label: 'Broker Connect', shortLabel: 'Broker' },
  { id: 4, label: 'Insurance Email Inside the Workflow', shortLabel: 'Mailman' },
  { id: 5, label: 'Assistant', shortLabel: 'Assistant' },
]

const PLATFORM_SECTIONS = [
  {
    title: 'Portfolio & Intake',
    body: 'Every line of coverage on one screen. Broker-ready workbooks in minutes, not days.',
  },
  {
    title: 'Assistant',
    body: 'Ask about your coverage in plain English. Grounded in your imported policies.',
  },
  {
    title: 'Broker Connect',
    body: 'COIs, endorsements, and renewals in one traceable outbound flow.',
  },
  {
    title: 'Mailman',
    body: 'Inbox and compose beside your portfolio without tab-hopping to Outlook.',
  },
  {
    title: 'Contract Reviewer',
    body: 'Upload contracts for a line-by-line compliance read. Spot gaps before sign-off and export findings to your broker.',
    walkthrough: true,
  },
]

const DOSSIER = [
  {
    id: 0,
    overview: true,
    title: 'Insurance Operations Workspace',
    eyebrow: 'AXIOM Enterprise Risk Platform',
    description:
      'One workspace for your insurance program inside AXIOM. Intake, compliance, and broker workflows share a single portfolio view. Outputs feed the rest of the risk stack, alongside your existing broker and carrier relationships.',
  },
  {
    id: 1,
    src: '/insurance-manager/booklet/02-portfolio-overview-manual-import.png',
    title: 'All Coverages in One View',
    description:
      'GL, Auto, Property, WC, and Umbrella on one screen: dates, carriers, limits, exposures, and premiums.',
    primary: [
      'AI extraction or guided manual import per line',
      'One-click exposure workbooks and BOR letters',
      'MODE toggle: AI or manual, same outputs',
    ],
    callouts: [
      'Whole program visible in minutes',
      'Hybrid automation: speed or auditability',
    ],
  },
  {
    id: 2,
    screenshotTiles: [
      { src: '/insurance-manager/booklet/03-exposures-gl-locations.png' },
      { src: '/insurance-manager/booklet/03-exposures-gl-exposures.png' },
      { src: '/insurance-manager/booklet/05-exposures-workers-comp-class-codes.png' },
      { src: '/insurance-manager/booklet/04-exposures-auto-vehicles.png' },
    ],
    quadCallout: {
      logo: '/insurance-manager/nhtsa-logo.png',
      title: 'NHTSA VIN Check',
      body: 'VINs decoded via NHTSA vPIC: make, model, and type compared to your schedule.',
    },
    screenshotLayout: 'quad',
    title: 'Detailed Exposure Views',
    description:
      'Underwriter-ready schedules by line: GL locations, Auto fleet with NHTSA VIN check, WC payroll totals.',
    primary: [
      'Sortable GL and Auto tables with Excel export',
      'NHTSA VIN validation with one-click corrections',
      'WC class codes with grand-total payroll',
    ],
    callouts: [
      'One model across Portfolio, Assistant, and Broker Connect',
      'Raw JSON tab on every line',
    ],
  },
  {
    id: 3,
    srcs: [
      '/insurance-manager/booklet/06-broker-connect-new-endorsement.png',
      '/insurance-manager/booklet/06-broker-connect-applications.png',
    ],
    screenshotLayout: 'stack',
    title: 'Broker Connect',
    description:
      'Endorsements, COIs, and renewal applications in one traceable flow with numbered outbound records.',
    primary: [
      'Stack portfolio-wide changes into one broker email',
      'Upload carrier forms and stage renewal docs',
      'COI requests with COI-1 · END-1 tracker',
    ],
    callouts: [
      'One transaction across the portfolio',
      'Request history without leaving the app',
    ],
  },
  {
    id: 4,
    srcs: [
      '/insurance-manager/booklet/10-mailman-inbox-powered-by-nylas.png',
      '/insurance-manager/booklet/12-mailman-compose-reply-in-context.png',
      '/insurance-manager/booklet/11-mailman-compose-new-email.png',
    ],
    screenshotLayout: 'gallery',
    title: 'Insurance Email Inside the Workflow',
    description:
      'Outlook via Nylas: Inbox, Sent, and compose beside your portfolio imports.',
    primary: [
      'Reply or compose with attachments and thread tagging',
      'COI threads tied to workspace context',
      'Integrated with Broker Connect outbound tracker',
    ],
    callouts: [
      'Email stays inside operations',
      'API keys stay server-side',
    ],
  },
  {
    id: 5,
    srcs: [
      '/insurance-manager/booklet/13-assistant-01-general-chat.png',
      '/insurance-manager/booklet/14-assistant-02-compliance-start.png',
    ],
    screenshotLayout: 'assistant-pair',
    complianceSteps: [
      {
        src: '/insurance-manager/booklet/15-assistant-03-compliance-upload.png',
        title: 'Add contracts and analyze',
        body: 'Upload contracts (.txt or .md), batch if needed, then Analyze. Requirements are checked against coverages in Portfolio.',
      },
      {
        src: '/insurance-manager/booklet/16-assistant-04-compliance-reading.png',
        title: 'Reading your contract',
        body: 'Files are processed against policy data from your portfolio imports.',
      },
      {
        src: '/insurance-manager/booklet/17-assistant-05-compliance-review-gaps.png',
        title: 'Gap identification',
        body: 'Each requirement mapped to your program. Non-compliant rows flag gaps with citations to policy files.',
      },
      {
        src: '/insurance-manager/booklet/18-assistant-06-compliance-review-partial.png',
        title: 'Partial matches',
        body: 'Partial when limits almost align but endorsements or waivers still need broker follow-up.',
      },
      {
        src: '/insurance-manager/booklet/19-assistant-07-compliance-review-compliant.png',
        title: 'Compliant requirements',
        body: 'Compliant rows confirm limits meet contract language. Export Excel and send to your broker.',
      },
    ],
    title: 'Assistant',
    description:
      'Coverage intelligence in the same workspace: General Chat grounded in your session, Compliance for contract review.',
    primary: [
      'Cloud or offline AI model choice',
      'Compliance: upload contracts, map gaps, export to broker',
    ],
    callouts: [
      'Grounded on vault facts, not invented limits',
      'Offline mode for data residency',
    ],
  },
]

const COMPLIANCE_WALKTHROUGH_STEPS = DOSSIER.find(item => item.complianceSteps)?.complianceSteps ?? []

function normalizeScreenshotTiles(item) {
  const raw = item.screenshotTiles ?? item.srcs ?? (item.src ? [item.src] : [])
  return raw.map(entry => (typeof entry === 'string' ? { src: entry } : entry))
}

function getScreenshotFrameClass(item) {
  if (item.compact) return 'w-fit max-w-[360px] mx-auto'
  return 'w-full'
}

function screenshotImageClass(item, layout, index) {
  if (item.compact) return 'h-[240px] w-auto max-w-full object-contain'

  if (layout === 'pair') return 'w-full h-auto object-contain'
  if (layout === 'quad') return 'w-full h-auto object-contain object-top'
  if (layout === 'gallery') {
    if (index === 0) return 'w-full h-auto object-contain'
    if (index === 2) return 'w-full h-auto max-h-[280px] object-contain object-top mx-auto'
    return 'w-full h-auto object-contain'
  }
  if (layout === 'stack') {
    const count = normalizeScreenshotTiles(item).length
    return count <= 2
      ? 'w-full h-auto object-contain'
      : 'w-full h-auto max-h-[240px] object-contain'
  }
  return 'w-full h-auto max-h-[min(480px,70vh)] object-contain object-top'
}

function ComplianceDetailPopup({ open, onClose, steps }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#050505]/90 backdrop-blur-md p-0 sm:items-center sm:px-4 sm:py-8 md:px-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex max-h-[min(92dvh,100%)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-[#8d8d8d] bg-[#161616] shadow-2xl sm:max-h-[min(85vh,820px)] sm:rounded-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            <motion.div className="flex items-center justify-between px-5 md:px-7 py-4 border-b im-accent-bar shrink-0">
              <motion.div>
                <p className="text-[9px] tracking-[0.22em] im-accent-fg-muted uppercase">Insurance Manager</p>
                <h4 className="font-display text-lg md:text-xl font-semibold im-accent-fg mt-1">Contract Reviewer</h4>
              </motion.div>
              <button
                type="button"
                onClick={onClose}
                className="im-accent-close flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#333] uppercase sm:h-auto sm:w-auto sm:border-0"
                aria-label="Close"
              >
                <span className="sm:hidden" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="hidden sm:inline">Close</span>
              </button>
            </motion.div>

            <div className="sleek-scrollbar flex-1 min-h-0 overflow-y-auto px-5 md:px-7 py-5 space-y-5">
              {steps.map((step, index) => (
                <motion.article
                  key={step.src}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="rounded-xl border border-[#2d2d2d] bg-[#121212] overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1.05fr,0.95fr] gap-0">
                    <div className="bg-[#151515] p-3 md:p-4 border-b md:border-b-0 md:border-r border-[#2a2a2a]">
                      <div className="rounded-lg border border-[#303030] bg-[#111111] p-2 flex items-start justify-center">
                        <img
                          src={step.src}
                          alt={step.title}
                          className="w-full h-auto object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <motion.div className="p-4 md:p-5">
                      <p className="text-[9px] tracking-[0.24em] text-ink-faint uppercase tabular-nums">
                        Step {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
                      </p>
                      <h5 className="font-display text-base md:text-lg font-semibold text-white pb-2 mb-2 mt-1 im-title-rule">
                        {step.title}
                      </h5>
                      <p className="text-[11px] leading-relaxed text-ink-secondary">{step.body}</p>
                    </motion.div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AssistantScreenshotPanel({ item }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [hero, complianceStart] = item.srcs ?? []

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-1.5 w-full items-stretch"
      >
        <img
          src={hero}
          alt={`${item.title} general chat`}
          className="w-full h-auto object-contain"
          loading="lazy"
          decoding="async"
        />
        <div className="relative w-full">
          <img
            src={complianceStart}
            alt={`${item.title} compliance`}
            className="w-full h-auto object-contain"
            loading="lazy"
            decoding="async"
          />
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="absolute bottom-2 right-2 px-2 py-1 rounded border border-[#c9922a]/90 bg-[#141008]/95 text-[9px] tracking-[0.22em] text-[#f5c842] uppercase transition-all hover:border-[#ffb347] hover:text-[#ffe08a] hover:shadow-[0_0_14px_rgba(255,165,0,0.8),0_0_30px_rgba(255,100,0,0.5)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#ffb347] focus-visible:outline-offset-2"
            aria-label="Open Compliance walkthrough"
          >
            Click me
          </button>
        </div>
      </motion.div>
      <ComplianceDetailPopup
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        steps={item.complianceSteps ?? []}
      />
    </>
  )
}

function ScreenshotPanel({ item }) {
  const tiles = normalizeScreenshotTiles(item)
  const sources = tiles.map(tile => tile.src)
  const layout = item.screenshotLayout ?? (sources.length > 1 ? 'stack' : 'single')

  if (layout === 'assistant-pair' && sources.length >= 2) {
    return <AssistantScreenshotPanel item={item} />
  }

  if (sources.length > 0) {
    if (layout === 'gallery' && sources.length >= 3) {
      const [hero, ...rest] = sources

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid w-full gap-1.5"
        >
          <img
            src={hero}
            alt={`${item.title} inbox`}
            className={screenshotImageClass(item, layout, 0)}
            loading="lazy"
            decoding="async"
          />
          <motion.div className="flex flex-col gap-1.5 w-full items-start">
            {rest.map((src, index) => (
              <img
                key={src}
                src={src}
                alt={`${item.title} ${index + 2}`}
                className={screenshotImageClass(item, layout, index + 1)}
                loading="lazy"
                decoding="async"
              />
            ))}
          </motion.div>
        </motion.div>
      )
    }

    if (layout === 'hero-detail' && sources.length === 2) {
      const [hero, detail] = sources

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid w-full gap-1.5"
        >
          <img
            src={hero}
            alt={`${item.title} overview`}
            className="w-full h-auto max-h-[280px] object-contain object-top"
            loading="lazy"
            decoding="async"
          />
          <motion.div className="flex justify-center">
            <img
              src={detail}
              alt={`${item.title} manual import`}
              className="h-auto w-full max-w-[300px] object-contain"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        </motion.div>
      )
    }

    if (layout === 'quad') {
      const calloutIndex = item.quadCallout ? tiles.length - 1 : -1

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full"
        >
          <motion.div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 items-start">
            {tiles.map((tile, index) => (
              <motion.div
                key={tile.src}
                className="flex flex-col overflow-hidden rounded bg-[#0a0a0a]"
              >
                <motion.div
                  className={`flex items-start justify-center ${
                    index === calloutIndex ? 'px-1.5 pt-1.5 pb-0' : 'p-1.5'
                  }`}
                >
                  <img
                    src={tile.src}
                    alt={`${item.title}${tiles.length > 1 ? ` ${index + 1}` : ''}`}
                    className={screenshotImageClass(item, layout, index)}
                    loading="lazy"
                    decoding="async"
                  />
                </motion.div>
                {index === calloutIndex && item.quadCallout && (
                  <motion.div className="flex items-center gap-1.5 px-2 pt-0.5 pb-1.5 shrink-0">
                    <img
                      src={item.quadCallout.logo}
                      alt="NHTSA"
                      className="h-6 w-auto shrink-0 object-contain rounded-sm"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold tracking-[0.1em] text-white uppercase leading-none">
                        {item.quadCallout.title}
                      </p>
                      <p className="text-[9px] leading-snug text-ink-secondary mt-0.5">{item.quadCallout.body}</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )
    }

    const layoutClass =
      layout === 'stack' || layout === 'pair'
        ? 'flex flex-col gap-1.5 w-full items-start'
        : 'w-full'

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={layoutClass}
      >
        {sources.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`${item.title}${sources.length > 1 ? ` ${index + 1}` : ''}`}
            className={screenshotImageClass(item, layout, index)}
            loading="lazy"
            decoding="async"
          />
        ))}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center px-8 py-12 w-full min-h-[280px]"
    >
      <p className="text-[9px] tracking-[0.24em] text-ink-muted uppercase">Product frame</p>
      <p className="font-display text-base text-white mt-3 max-w-[240px] leading-snug">{item.title}</p>
      <p className="text-[10px] text-ink-faint mt-3 tracking-[0.18em] uppercase">Screenshot re-export pending</p>
    </motion.div>
  )
}

export default function InsuranceManagerModal({ open, onClose }) {
  const [activeSection, setActiveSection] = useState(0)
  const [complianceWalkthroughOpen, setComplianceWalkthroughOpen] = useState(false)
  const scrollRef = useRef(null)
  const sectionRefs = useRef([])
  const filteredDossier = useMemo(() => DOSSIER, [])

  useEffect(() => {
    if (!open) return
    setActiveSection(DOSSIER[0]?.id ?? 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = orig
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const root = scrollRef.current
    if (!root) return

    let rafId = null

    const updateActive = () => {
      const rootRect = root.getBoundingClientRect()
      const rootCenter = rootRect.top + rootRect.height / 2

      let closestId = null
      let closestDistance = Infinity

      sectionRefs.current.forEach(node => {
        if (!node) return
        const rect = node.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const distance = Math.abs(center - rootCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closestId = Number(node.getAttribute('data-dossier-id'))
        }
      })

      if (closestId) {
        setActiveSection(prev => (prev === closestId ? prev : closestId))
      }
    }

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateActive)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    updateActive()

    return () => {
      root.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [open, filteredDossier])

  const scrollToSection = useCallback(id => {
    const idx = filteredDossier.findIndex(item => item.id === id)
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [filteredDossier])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="im-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-[#050505]/95 backdrop-blur-xl"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 shrink-0 border-b border-[#9AA0A8]/35 px-4 py-3 md:px-10"
          >
            <div className="flex w-full items-center justify-between gap-3 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-display text-base font-semibold uppercase leading-tight tracking-[0.08em] text-white sm:text-lg md:text-xl">
                  Insurance Manager
                </p>
                <p className="mt-0.5 hidden text-[9px] uppercase tracking-[0.22em] text-ink-faint sm:block">
                  Insured Operations Intelligence Dossier
                </p>
                <p className="mt-1 font-mono text-[10px] tabular-nums tracking-[0.12em] text-[#9AA0A8] xl:hidden">
                  {String(filteredDossier.findIndex(item => item.id === activeSection) + 1).padStart(2, '0')} /{' '}
                  {String(filteredDossier.length).padStart(2, '0')}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex shrink-0 items-center gap-1.5 sm:gap-4 md:gap-6"
              >
                <span className="hidden font-display text-[10px] tabular-nums tracking-[0.3em] text-ink-faint xl:inline">
                  {String(filteredDossier.findIndex(item => item.id === activeSection) + 1).padStart(2, '0')} /{' '}
                  {String(filteredDossier.length).padStart(2, '0')}
                </span>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  title="Close"
                  className="im-accent-close flex h-11 w-11 items-center justify-center uppercase sm:h-auto sm:w-auto"
                >
                  <span className="sm:hidden" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="hidden sm:inline">Close</span>
                </button>
              </motion.div>
            </div>
          </motion.div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[360px,1fr]">
            <div className="hidden h-full min-h-0 flex-col self-stretch border-r border-[#9AA0A8]/35 bg-[#080808] xl:flex">
              <div className="side-panel side-panel--compact side-panel--fill flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden">
                <div className="side-panel-content flex flex-col flex-1 min-h-0 h-full">
                  <div className="flex flex-1 min-h-0 flex-col">
                    <section className="side-panel-section shrink-0 border-b-0 pb-3">
                      <p className="text-[14px] font-medium leading-snug text-white/88">
                        Insurance operations without the scattered spreadsheets.
                      </p>
                      <p className="text-[13px] leading-relaxed text-ink-secondary mt-2.5">
                        One portfolio view for intake, compliance, and broker workflows. Auditable
                        outputs and broker-ready communication.
                      </p>
                    </section>

                    <section className="side-panel-section side-panel-section--modules flex flex-1 min-h-0 flex-col border-b-0 pb-2 pt-4">
                      <h3 className="shrink-0 mb-3 text-[12px] font-semibold tracking-[0.06em] uppercase text-[#9AA0A8]">
                        Platform Modules
                      </h3>
                      <div className="im-accent-rule mb-4 shrink-0" aria-hidden />
                      <div className="side-panel-module-list flex-1 min-h-0">
                        {PLATFORM_SECTIONS.map((section, i) => {
                          const motionProps = {
                            initial: { opacity: 0, y: 8 },
                            animate: { opacity: 1, y: 0 },
                            transition: { duration: 0.35, delay: 0.08 + i * 0.04, ease: [0.25, 0.1, 0.25, 1] },
                          }

                          if (section.walkthrough) {
                            return (
                              <motion.button
                                key={section.title}
                                type="button"
                                {...motionProps}
                                onClick={() => setComplianceWalkthroughOpen(true)}
                                className="side-panel-module side-panel-module--interactive"
                                aria-label={`${section.title}: open walkthrough`}
                              >
                                <p className="side-panel-module-title text-[13px]">{section.title}</p>
                                <p className="text-[13px] leading-relaxed text-ink-secondary">{section.body}</p>
                              </motion.button>
                            )
                          }

                          return (
                            <motion.div
                              key={section.title}
                              {...motionProps}
                              className="side-panel-module"
                            >
                              <p className="side-panel-module-title text-[13px]">{section.title}</p>
                              <p className="text-[13px] leading-relaxed text-ink-secondary">{section.body}</p>
                            </motion.div>
                          )
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div
                ref={scrollRef}
                className="sleek-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-8 xl:px-12 xl:pb-16 [-webkit-overflow-scrolling:touch] max-xl:scroll-pb-[calc(4rem+env(safe-area-inset-bottom))]"
              >
              <div className="space-y-6 md:space-y-8">
                {filteredDossier.map((item, idx) => (
                  <article
                    key={item.id}
                    ref={node => {
                      sectionRefs.current[idx] = node
                    }}
                    data-dossier-id={item.id}
                    className={`scroll-mt-14 ${
                      item.overview
                        ? 'w-full'
                        : `w-full rounded-2xl border overflow-hidden transition ${
                            activeSection === item.id
                              ? 'border-[#9AA0A8] bg-[#161616]'
                              : 'border-[#2d2d2d] bg-[#121212]'
                          }`
                    }`}
                  >
                    {item.overview ? (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                        className="pb-2 md:pb-4"
                      >
                        <p className="text-[9px] tracking-[0.22em] text-[#9AA0A8] uppercase">{item.eyebrow}</p>
                        <h3 className="font-display text-2xl md:text-3xl font-semibold text-white mt-1.5 mb-3 im-title-rule pb-3">
                          {item.title}
                        </h3>
                        <p className="text-[12px] md:text-[13px] leading-[1.75] text-ink-primary max-w-3xl">
                          {item.description}
                        </p>
                      </motion.div>
                    ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                      className="grid grid-cols-1 gap-0 items-start"
                    >
                      <motion.div
                        className={`bg-[#151515] ${item.compact ? 'p-3 md:p-6' : 'p-3 md:p-5'}`}
                        whileHover={{ backgroundColor: '#181818' }}
                        transition={{ duration: 0.25 }}
                      >
                      <motion.div
                        className={`rounded-lg border border-[#303030] bg-[#111111] p-1.5 ${getScreenshotFrameClass(item)}`}
                      >
                          <ScreenshotPanel item={item} />
                        </motion.div>
                      </motion.div>
                      <motion.div className="flex flex-col justify-center gap-5 border-t border-[#2a2a2a] p-5 md:gap-7 md:p-6 lg:p-8 mx-auto w-full max-w-none">
                        <div>
                          <h3 className="font-display text-2xl md:text-3xl font-semibold text-white pb-2 mb-3 im-title-rule">
                            {item.title}
                          </h3>
                          <p className="text-[13px] md:text-sm leading-relaxed text-ink-secondary">{item.description}</p>
                        </div>

                        <motion.div
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.1, duration: 0.35 }}
                        >
                          <p className="text-sm font-semibold tracking-[0.18em] uppercase text-[#9AA0A8]">
                            Primary Features
                          </p>
                          <div className="im-accent-rule mt-2 mb-3" aria-hidden />
                          <ul className="space-y-2">
                            {item.primary.map(point => (
                              <li key={point} className="text-[13px] md:text-sm text-ink-primary leading-relaxed">
                                {point}
                              </li>
                            ))}
                          </ul>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.15, duration: 0.35 }}
                        >
                          <p className="text-sm font-semibold tracking-[0.18em] uppercase text-[#9AA0A8]">
                            Operational Callouts
                          </p>
                          <div className="im-accent-rule mt-2 mb-3" aria-hidden />
                          <ul className="space-y-2">
                            {item.callouts.map(point => (
                              <li key={point} className="text-[13px] md:text-sm text-ink-secondary leading-relaxed">
                                {point}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                    )}
                  </article>
                ))}
              </div>
              </div>

              <DossierMobileNav
                sections={IM_NAV_SECTIONS}
                activeId={activeSection}
                onSelect={scrollToSection}
              />
            </div>
          </div>

          <ComplianceDetailPopup
            open={complianceWalkthroughOpen}
            onClose={() => setComplianceWalkthroughOpen(false)}
            steps={COMPLIANCE_WALKTHROUGH_STEPS}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
