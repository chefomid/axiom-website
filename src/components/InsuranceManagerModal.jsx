import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PLATFORM_SECTIONS = [
  {
    title: 'Portfolio & Intake',
    body: 'Policy PDFs in, structured JSON in: one portfolio session per workspace. Exposure workbooks and BOR letters from the same book.',
  },
  {
    title: 'Assistant',
    body: 'Embedded coverage intelligence: model choice including offline mode, session-grounded chat, and contract compliance review with broker-ready reports.',
  },
  {
    title: 'Broker Connect',
    body: 'Endorsements, COI requests, and applications stack into one broker transaction. Edit in context, review stacked changes, confirm once, and send with a numbered outbound record (COI-1 · END-1).',
  },
  {
    title: 'Mailman',
    body: 'Outlook via Nylas keeps certificate and broker threads beside your portfolio. Inbox, compose, tag threads, and outbound tracking without leaving the command center.',
  },
]

const DOSSIER = [
  {
    id: 0,
    overview: true,
    title: 'Insurance Operations Workspace',
    eyebrow: 'AXIOM Enterprise Risk Platform',
    description:
      'AXIOM Insurance Manager is the insurance operations workspace inside AXIOM\u2019s enterprise risk platform. Teams maintain one portfolio view as the program changes, run compliance and broker workflows from that same environment, and produce structured digital assets (normalized program data, exposure outputs, compliance results, request history) that other AXIOM tools can consume. It also takes inputs from across the ecosystem, so insurance-side reasoning stays connected to wider operational and risk data. For holistic ERM, it is where the insurance book lives, where change is tracked, and where insurance intelligence flows into the rest of the stack, alongside your existing broker and carrier relationships, not in place of them.',
  },
  {
    id: 1,
    src: '/insurance-manager/booklet/02-portfolio-overview-manual-import.png',
    title: 'All Coverages in One View',
    description:
      'Portfolio Overview surfaces GL, Auto, Property, Workers Compensation (WC), and Umbrella on one screen in your AXIOM workspace: effective dates, carriers, limits, exposure counts, and premiums without spreadsheet archaeology.',
    primary: [
      'GL, Auto, Property, WC, and Umbrella on one screen',
      'AI extraction or schema-guided manual import per line of coverage',
      'Download per-LOB instructions, run your agent on policy PDFs, upload .txt or .json',
      'One-click exposure workbooks and BOR letters',
    ],
    callouts: [
      'Once data is in the workspace, executives and risk teams see the whole program in minutes',
      'MODE toggle: AI or Manual, same overview and deliverables',
      'Hybrid automation: speed when you want it, auditability when you need it',
      'Three-step manual sidebar: download, run agent, upload JSON',
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
      body: 'Each VIN is decoded through NHTSA\u2019s vPIC database. Official make, model, and vehicle type are compared to your schedule.',
    },
    screenshotLayout: 'quad',
    title: 'Detailed Exposure Views',
    description:
      'Exposures by coverage line give underwriter-ready schedules in one place: GL locations and ISO class exposures, Auto fleet with NHTSA VIN validation, and WC class codes with grand-total payroll, all tied to the same session as Assistant and Broker Connect.',
    primary: [
      'GL locations and ISO class exposures in sortable tables with session export and Excel workbooks',
      'Auto vehicles with NHTSA VIN Check and one-click accept corrections',
      'WC class codes, basis, and amounts by state with grand total payroll',
    ],
    callouts: [
      'One normalized model across Portfolio, Assistant, and Broker Connect',
      'Raw JSON tab for technical review on every line',
      'Fewer re-keying errors before renewal and endorsement season',
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
      'Endorsements and COI requests in one traceable flow, plus application intake for renewal season. Stack portfolio-wide endorsement changes into one broker email with a PDF slip and numbered tracker (COI-1 · END-1).',
    primary: [
      'Session rail lists GL, Auto, Property, WC, Umbrella, and Account: start one transaction, stack every change',
      'Endorsements tab: edit coverages across the portfolio, review change summary before send, confirm once',
      'Applications tab: upload carrier forms (PDF, Word, Excel) and optional prior-year reference files; financials for prep (fill workflow connecting)',
      'COI requests and outbound tracker (COI-1 · END-1) in the same workspace',
    ],
    callouts: [
      'One endorsement transaction across the portfolio, not version-7 spreadsheets',
      'Stop re-hunting last year\'s app: stage forms and supporting docs for renewal',
      'Endorsements · COI · Applications: formal request and numbered request history without leaving the app',
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
      'Mailman is powered by Nylas · Outlook: Inbox, Sent, and Spam beside your portfolio imports. Reply to COI threads in context or compose a new message with To, CC, Subject, and attachments. Attach, tag, and send without switching to Outlook.',
    primary: [
      'Inbox, Sent, Spam with search and unread filter, with COI threads beside portfolio imports',
      'Reply in-thread with Send, Attach file, and Tag threads to COI/endorsement requests',
      'Compose new email: To, CC, Subject, message, and optional attachments',
      'Integrated with Broker Connect outbound (COI-1 · END-1 tracker)',
      'Powered by Nylas · Outlook sync',
    ],
    callouts: [
      'Communication is part of operations, not a separate Outlook tab',
      'Certificate threads tied to workspace context',
      'New email or reply: same Mailman panel, same outbound tracker',
      'Compose without leaving AXIOM: discard, tag, and send in one place',
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
        body: 'Drop or browse contract files in Compliance (.txt and .md work best). Batch several files, review the list, then click Analyze. Requirements are extracted from your contracts and checked against coverages already in Portfolio.',
      },
      {
        src: '/insurance-manager/booklet/16-assistant-04-compliance-reading.png',
        title: 'Reading your contract',
        body: 'Assistant processes uploaded files against policy data from your portfolio imports. Your API key runs the checks; large files may be truncated per model limits.',
      },
      {
        src: '/insurance-manager/booklet/17-assistant-05-compliance-review-gaps.png',
        title: 'Gap identification',
        body: 'The review table maps each contract requirement to your program. Non-compliant rows flag missing coverage with explanations and citations back to declarations, forms schedules, and policy files in your workspace.',
      },
      {
        src: '/insurance-manager/booklet/18-assistant-06-compliance-review-partial.png',
        title: 'Partial matches',
        body: 'Partial status when limits or wording almost align but endorsements, additional insured status, waivers, or duration requirements still need broker follow-up. Each row cites the closest proof found in your book.',
      },
      {
        src: '/insurance-manager/booklet/19-assistant-07-compliance-review-compliant.png',
        title: 'Compliant requirements',
        body: 'Compliant rows confirm umbrella, WC, GL, auto, and other limits meet contract language with source references. Download Excel, save to workspace, tag the request, and send the report to your broker from the page.',
      },
    ],
    title: 'Assistant',
    description:
      'Assistant is an embedded logic layer in the same workspace as your portfolio. Choose the AI model that fits your policy, including offline mode when you want local computation (slower, but stays on your machine). Two primary workflows: General Chat for coverage questions grounded in your session, and Compliance for contract review against the book you have imported.',
    primary: [
      'Model selector: cloud models or offline AI mode (local compute, slower throughput)',
      'General Chat: ask coverage questions with evidence tables tied to your portfolio session',
      'Compliance: upload contracts, map requirements to your program, and surface coverage gaps',
      'Compliance report: Download Excel, save to workspace, tag, and send to your broker from the page',
    ],
    callouts: [
      'Same normalized session as Portfolio, Exposures, Broker Connect, and Mailman',
      'Tool-grounded on vault facts in your workspace, not invented limits or carriers',
      'Compliance can communicate on your behalf to close gaps and handle broker redlines',
      'Offline mode when data residency or air-gapped review matters',
    ],
  },
]

function normalizeScreenshotTiles(item) {
  const raw = item.screenshotTiles ?? item.srcs ?? (item.src ? [item.src] : [])
  return raw.map(entry => (typeof entry === 'string' ? { src: entry } : entry))
}

function getScreenshotFrameClass(item) {
  if (item.compact) return 'min-h-[260px] w-fit max-w-[360px] mx-auto'
  const tileCount = normalizeScreenshotTiles(item).length
  if (item.screenshotLayout === 'pair' || item.screenshotLayout === 'assistant-pair' || item.screenshotLayout === 'gallery' || item.screenshotLayout === 'quad' || item.screenshotLayout === 'hero-detail' || tileCount > 1) {
    return 'min-h-0 w-full'
  }
  return 'min-h-[390px] w-full'
}

function screenshotImageClass(item, layout, index) {
  if (item.compact) return 'h-[240px] w-auto max-w-full object-contain'

  if (layout === 'pair') return 'w-full h-auto object-contain'
  if (layout === 'quad') return 'max-w-full max-h-full w-auto h-auto object-contain'
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
  return 'w-full max-h-[520px] object-contain'
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050505]/90 backdrop-blur-md px-4 py-8 md:px-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-4xl max-h-[min(85vh,820px)] rounded-2xl border border-[#8d8d8d] bg-[#161616] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <motion.div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-[#2d2d2d] shrink-0">
              <motion.div>
                <p className="text-[9px] tracking-[0.22em] text-ink-muted uppercase">Assistant · Compliance</p>
                <h4 className="font-display text-lg md:text-xl font-semibold text-white mt-1">Contract review walkthrough</h4>
              </motion.div>
              <button
                type="button"
                onClick={onClose}
                className="text-ink-muted hover:text-white transition-colors text-[10px] tracking-[0.3em] uppercase shrink-0"
              >
                Close
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
                      <h5 className="font-display text-base md:text-lg font-semibold text-white pb-2 mb-2 mt-1 border-b border-[#2d2d2d]">
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
        className="flex flex-col gap-2 w-full items-stretch"
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
          className="grid w-full gap-2"
        >
          <img
            src={hero}
            alt={`${item.title} inbox`}
            className={screenshotImageClass(item, layout, 0)}
            loading="lazy"
            decoding="async"
          />
          <motion.div className="grid grid-cols-1 sm:grid-cols-[1.15fr_0.85fr] gap-2 items-start">
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
          className="grid w-full gap-2"
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
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 sm:aspect-[2/1] gap-2">
            {tiles.map((tile, index) => (
              <motion.div
                key={tile.src}
                className="flex flex-col bg-[#0a0a0a] overflow-hidden aspect-[16/10] sm:aspect-auto sm:h-full rounded"
              >
                <motion.div
                  className={`flex flex-1 items-center justify-center min-h-0 ${
                    index === calloutIndex ? 'px-2 pt-2 pb-0' : 'p-2'
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
      layout === 'pair'
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 w-full items-start'
        : layout === 'stack'
          ? 'flex flex-col gap-2 w-full items-stretch'
          : 'flex w-full items-center justify-center'

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

  const progress = useMemo(() => {
    const idx = filteredDossier.findIndex(item => item.id === activeSection)
    if (idx < 0) return 0
    return filteredDossier.length <= 1 ? 1 : idx / (filteredDossier.length - 1)
  }, [activeSection, filteredDossier])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="im-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-xl flex flex-col"
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-between px-8 md:px-14 pt-7 pb-5 relative z-10 border-b border-[#141414]"
          >
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <p className="font-display text-xl md:text-2xl font-semibold text-white tracking-[0.08em] uppercase">
                Insurance Manager
              </p>
              <p className="text-[10px] tracking-[0.24em] text-ink-faint uppercase mt-1">
                Insured Operations Intelligence Dossier
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex items-center gap-6"
            >
              <span className="font-display text-[10px] text-ink-faint tabular-nums tracking-[0.3em]">
                {String(filteredDossier.findIndex(item => item.id === activeSection) + 1).padStart(2, '0')} /{' '}
                {String(filteredDossier.length).padStart(2, '0')}
              </span>
              <a
                href="/insurance-manager/Insurance-Manager-Booklet.pdf"
                target="_blank"
                rel="noreferrer"
                className="text-ink-muted hover:text-white transition-colors text-[10px] tracking-[0.3em] uppercase"
              >
                Open Booklet PDF
              </a>
              <button
                onClick={onClose}
                className="text-ink-muted hover:text-white transition-colors text-[10px] tracking-[0.3em] uppercase"
              >
                Close
              </button>
            </motion.div>
          </motion.div>

          <div className="absolute left-0 right-0 top-[78px] h-px bg-[#131313] z-10">
            <motion.div
              className="h-full bg-[#9a9a9a] origin-left"
              style={{ scaleX: progress }}
              transition={{ ease: 'linear', duration: 0.05 }}
            />
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-0 pt-3">
            <div className="border-r border-[#2a2a2a] px-5 md:px-8 py-4 bg-[#0f0f0f] h-full flex items-stretch">
              <div className="rounded-xl border border-[#323232] bg-[#171717] p-4 flex flex-col h-full w-full min-h-0">
                <div className="shrink-0">
                  <p className="text-[9px] tracking-[0.22em] text-ink-muted uppercase">Insurance Manager</p>
                  <h2 className="font-display text-lg text-white leading-tight mt-1.5">
                    Your program in one workspace.
                  </h2>
                  <p className="text-xs text-ink-secondary leading-snug mt-2">
                    Faster intake. One portfolio view per workspace. Broker-ready communication: a command center for the insured.
                  </p>
                </div>

                <div className="flex-1 flex flex-col justify-evenly py-4 min-h-0">
                  {PLATFORM_SECTIONS.map((section, i) => (
                    <motion.div
                      key={section.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.12 + i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <p className="text-[14px] font-medium text-white pb-1.5 mb-2 border-b border-[#2d2d2d]">
                        {section.title}
                      </p>
                      <p className="text-xs text-ink-secondary leading-relaxed">{section.body}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="sleek-scrollbar min-h-0 overflow-y-auto px-5 md:px-8 xl:px-12 pt-4 pb-16">
              <div className="space-y-8">
                {filteredDossier.map((item, idx) => (
                  <article
                    key={item.id}
                    ref={node => {
                      sectionRefs.current[idx] = node
                    }}
                    data-dossier-id={item.id}
                    className={`w-full rounded-2xl border overflow-hidden transition ${
                      item.overview
                        ? activeSection === item.id
                          ? 'border-[#8d8d8d] bg-[#252525]'
                          : 'border-[#3a3a3a] bg-[#222222]'
                        : activeSection === item.id
                          ? 'border-[#8d8d8d] bg-[#161616]'
                          : 'border-[#2d2d2d] bg-[#121212]'
                    }`}
                  >
                    {item.overview ? (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                        className="p-6 md:p-8"
                      >
                        <p className="text-[9px] tracking-[0.22em] text-ink-muted uppercase">{item.eyebrow}</p>
                        <h3 className="font-display text-2xl md:text-3xl font-semibold text-white pb-2 mb-3 mt-1.5 border-b border-[#2d2d2d]">
                          {item.title}
                        </h3>
                        <p className="text-[12px] md:text-[13px] leading-[1.75] text-ink-primary">{item.description}</p>
                      </motion.div>
                    ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                      className={`grid grid-cols-1 gap-0 items-stretch ${
                        item.compact ? '2xl:grid-cols-[0.82fr,1.18fr]' : '2xl:grid-cols-[1.16fr,0.84fr]'
                      }`}
                    >
                      <motion.div
                        className={`bg-[#151515] ${item.compact ? 'p-6 md:p-8' : 'p-5 md:p-7'}`}
                        whileHover={{ backgroundColor: '#181818' }}
                        transition={{ duration: 0.25 }}
                      >
                        <motion.div
                          className={`rounded-lg border border-[#303030] bg-[#111111] p-2 flex items-start justify-center ${getScreenshotFrameClass(item)}`}
                        >
                          <ScreenshotPanel item={item} />
                        </motion.div>
                      </motion.div>
                      <motion.div className="border-l border-[#2a2a2a] p-5 md:p-7 flex flex-col justify-start 2xl:justify-center 2xl:h-full gap-6 md:gap-8">
                        <div>
                          <h3 className="font-display text-xl md:text-2xl font-semibold text-white pb-2 mb-3 border-b border-[#2d2d2d]">
                            {item.title}
                          </h3>
                          <p className="text-[11px] leading-relaxed text-ink-secondary">{item.description}</p>
                        </div>

                        <motion.div
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.1, duration: 0.35 }}
                        >
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white pb-1.5 mb-2 border-b border-[#2d2d2d]">
                            Primary Features
                          </p>
                          <ul className="space-y-1.5">
                            {item.primary.map(point => (
                              <li key={point} className="text-[11px] text-ink-primary leading-relaxed">
                                {point}
                              </li>
                            ))}
                          </ul>
                        </motion.div>

                        <motion.div
                          className="pt-6 border-t border-[#2d2d2d]"
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.15, duration: 0.35 }}
                        >
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white pb-1.5 mb-2 border-b border-[#2d2d2d]">
                            Operational Callouts
                          </p>
                          <ul className="space-y-1.5">
                            {item.callouts.map(point => (
                              <li key={point} className="text-[11px] text-ink-secondary leading-relaxed">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
