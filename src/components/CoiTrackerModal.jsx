import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const INTRO = {
  eyebrow: 'AXIOM Certificate Compliance',
  title: 'Commercial COI compliance on one platform.',
  description:
    'Portfolio onboarding, tenant email, certificate validation, and reporting, without switching tools.',
  highlights: [
    'Portfolio onboarding from rent rolls and lease language',
    'Enterprise email tied to tenant threads and COI history',
    'Compliance checks, gap tracking, and executive reporting',
  ],
}

const DOSSIER = [
  {
    id: 1,
    act: 'act1',
    src: '/coi-tracker/booklet/01-compliance-command-center.png',
    title: 'Compliance Command Center',
    role: 'Hero overview of day-to-day risk posture.',
    description:
      'The Compliance Dashboard gives operations teams a single command center for insurance risk. Open items, tenant-level status, and portfolio KPIs are surfaced in one view so teams can prioritize remediation instantly instead of hunting across spreadsheets and inboxes.',
    primary: ['Open Items queue with tenant-level actions', 'Live compliance KPI panel', 'Aging buckets for expiring and deficient COIs'],
    callouts: ['Immediate missing certificate visibility', 'Direct waive action routing', 'Timestamped data freshness']
  },
  {
    id: 2,
    act: 'act1',
    src: '/coi-tracker/booklet/02-property-portfolio-overview.png',
    title: 'Property Portfolio Overview',
    role: 'Portfolio context and property-level health.',
    description:
      'Property Portfolio turns scattered site data into a clear compliance map. Teams can compare each location\'s occupancy and certificate readiness, then drill into exactly where policy enforcement needs to tighten.',
    primary: ['Property cards with occupancy progress', 'Compliance rate by location', 'Quick actions for requirements and controls'],
    callouts: ['Building-by-building risk segmentation', 'At-a-glance occupancy and compliance relationship']
  },
  {
    id: 3,
    act: 'act1',
    src: '/coi-tracker/booklet/03-tenant-compliance-operations.png',
    title: 'Tenant Compliance Operations',
    role: 'Tenant-level workflow control.',
    description:
      'Tenant Management centralizes every tenant record, contact, and compliance state in one operational grid. From one screen, teams can trigger outreach, upload updated certificates, and close gaps faster.',
    primary: ['Tenant roster with compliance tags', 'Embedded contact details', 'Action shortcuts for email, upload, and edit'],
    callouts: ['Bulk-friendly tabular operations', 'Fast outreach from operational context', 'Segmentation at tenant record level']
  },
  {
    id: 4,
    act: 'act1',
    src: '/coi-tracker/booklet/04-certificate-registry-validation.png',
    title: 'Certificate Registry & Endorsement Validation',
    role: 'Source-of-truth proof for document status.',
    description:
      'The Certificates view provides an auditable, portfolio-wide registry of every COI with validation status, expiration windows, and endorsement checks. Teams gain a defensible record of what is compliant now and what needs remediation next.',
    primary: ['Certificate index by tenant and property', 'Effective and expiration timelines', 'Endorsement legend for AI/WOS/PNC'],
    callouts: ['Standardized validation states', 'Archive handling for historical documents', 'Readable endorsement checks for non-technical teams']
  },
  {
    id: 7,
    act: 'act2',
    src: '/coi-tracker/booklet/07-ai-coi-review-workspace.png',
    title: 'AI-Powered COI Review Workspace',
    role: 'Intake and analysis initiation.',
    description:
      'COI Review is the intake engine where incoming documents become actionable compliance data. Teams can upload at scale and run standardized analysis workflows to accelerate validation and exception handling.',
    primary: ['Drag/drop COI ingestion for PDF, JPG, PNG', 'Review queue panel', 'Mechanical and AI-assisted processing'],
    callouts: ['Batch-friendly upload behavior', 'Policy-baselined review and endorsement checks', 'Ready for extraction, matching, and analysis']
  },
  {
    id: 8,
    act: 'act3',
    src: '/coi-tracker/booklet/08-mailroom-thread-operations.png',
    title: 'Mailroom Thread Operations',
    role: 'Communication workflow hub.',
    description:
      'Mailroom unifies outbound requests and inbound tenant responses into a single thread-centric workspace. Teams can track every certificate conversation lifecycle without leaving the compliance platform.',
    primary: ['Tracked tenant thread list', 'Full conversation viewer', 'Tabs for tracked threads, autonomous mode, and mailbox'],
    callouts: ['Bi-directional thread context', 'Follow-up history in one pane', 'Approval-aware thread controls']
  },
  {
    id: 10,
    act: 'act3',
    src: '/coi-tracker/booklet/10-platform-settings-ai-configuration.png',
    title: 'Platform Settings & AI Configuration',
    role: 'Trust, branding, and integration controls.',
    description:
      'Settings centralizes platform governance: email infrastructure, outbound identity, and AI model controls. Teams can align communication quality and AI behavior to operational policy.',
    primary: ['Mailbox and sending integration settings', 'Outbound signature builder and preview', 'AI provider, model, and API key controls'],
    callouts: ['Signature import and export workflows', 'Model and provider flexibility', 'Automation governance controls']
  },
  {
    id: 11,
    act: 'act4',
    src: '/coi-tracker/booklet/11-executive-reporting-export.png',
    title: 'Executive Reporting & Export',
    role: 'Outcome visibility for leadership and audits.',
    description:
      'Data Export & Reports turns operational compliance data into executive-ready reporting. Leadership can measure portfolio risk, compare property performance, and export audit-friendly datasets instantly.',
    primary: ['Portfolio compliance scorecards', 'Property-by-property score summary', 'Export-to-Excel action'],
    callouts: ['Field-level export customization', 'Aggregated and segmented reporting', 'Shareable outputs for stakeholders']
  },
  {
    id: 12,
    act: 'act4',
    src: '/coi-tracker/booklet/12-report-builder-field-selection.png',
    title: 'Report Builder Field Selection',
    role: 'Detailed reporting configurability.',
    description:
      'The report field selector gives teams control over exactly what each export communicates, from summary metrics to granular validation evidence. This supports tailored reporting for operations, ownership, and compliance audits.',
    primary: ['Field groups for tenant, property, contact, and certificate data', 'Select-all and granular field control', 'Validation and deficiency metric selection'],
    callouts: ['Purpose-built exports by audience', 'Balance between summary KPIs and detailed evidence']
  },
  {
    id: 13,
    act: 'act4',
    src: '/coi-tracker/booklet/13-bulk-import-portfolio-onboarding.png',
    title: 'Bulk Import & Portfolio Onboarding',
    role: 'Adoption and scaling entry point.',
    description:
      'Import Data accelerates onboarding by turning existing spreadsheets into structured compliance records. Teams can launch quickly with guided templates, paste workflows, and batch ingestion pathways.',
    primary: ['CSV templates and guided instructions', 'Drag/drop ingestion and Excel paste support', 'Import modes for properties, tenants, and batch COI'],
    callouts: ['Reduced setup friction', 'Structured ingestion for cleaner downstream operations']
  },
]

export default function CoiTrackerModal({ open, onClose }) {
  const [activeSection, setActiveSection] = useState(1)
  const [onIntro, setOnIntro] = useState(true)
  const scrollRef = useRef(null)
  const introRef = useRef(null)
  const sectionRefs = useRef([])
  const filteredDossier = useMemo(() => DOSSIER, [])
  useEffect(() => {
    if (!open) return
    setActiveSection(DOSSIER[0]?.id || 1)
    setOnIntro(true)
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 })
    })
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
      const snapNodes = [introRef.current, ...sectionRefs.current].filter(Boolean)

      let closestNode = null
      let closestDistance = Infinity

      snapNodes.forEach(node => {
        const rect = node.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const distance = Math.abs(center - rootCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closestNode = node
        }
      })

      if (!closestNode) return

      if (closestNode === introRef.current) {
        setOnIntro(true)
        return
      }

      setOnIntro(false)
      const dossierId = Number(closestNode.getAttribute('data-dossier-id'))
      if (dossierId) {
        setActiveSection(prev => (prev === dossierId ? prev : dossierId))
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="coi-modal"
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
            className="relative z-10 shrink-0 border-b border-[#9AA0A8]/35 px-6 md:px-10 py-3"
          >
            <div className="flex w-full items-center justify-between gap-6">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                className="min-w-0 text-left"
              >
                <p className="font-display text-lg md:text-xl font-semibold text-white tracking-[0.08em] uppercase leading-tight">
                  COI Tracker
                </p>
                <p className="text-[9px] tracking-[0.22em] text-ink-faint uppercase mt-0.5">
                  Autonomous Certificate Intelligence Dossier
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex shrink-0 items-center gap-2 sm:gap-4 md:gap-6"
              >
                <span className="hidden font-display text-[10px] text-ink-faint tabular-nums tracking-[0.3em] sm:inline">
                  {onIntro
                    ? 'Overview'
                    : `${String(filteredDossier.findIndex(item => item.id === activeSection) + 1).padStart(2, '0')} / ${String(filteredDossier.length).padStart(2, '0')}`}
                </span>
                <a
                  href="/coi-tracker/COI-Tracker-Booklet.pdf"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open booklet PDF"
                  title="Open Booklet PDF"
                  className="flex h-11 w-11 items-center justify-center text-ink-muted transition-colors hover:text-white sm:h-auto sm:w-auto sm:text-[10px] sm:tracking-[0.3em] sm:uppercase"
                >
                  <span className="sm:hidden" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M10 2H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M10 2l5 5M10 2v5h5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="hidden sm:inline">Open Booklet PDF</span>
                </a>
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

          <div className="relative h-0 flex-1 min-h-0">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background: `
                  radial-gradient(ellipse 90% 60% at 50% 42%, rgba(154, 160, 168, 0.07) 0%, transparent 68%),
                  linear-gradient(180deg, #050505 0%, #070708 45%, #050505 100%)
                `,
              }}
            />
            <div ref={scrollRef} className="sleek-scrollbar relative z-10 h-full overflow-y-auto snap-y snap-proximity bg-[#050505]">
            <motion.section
              ref={introRef}
              data-snap-section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: onIntro ? 1 : 0.55, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex min-h-[calc(100dvh-3.75rem)] shrink-0 snap-center items-center justify-center px-6 md:px-10 xl:px-16 py-10"
            >
              <div className="relative mx-auto max-w-3xl w-full">
                <p className="text-[9px] tracking-[0.22em] text-[#9AA0A8] uppercase">{INTRO.eyebrow}</p>
                <h2 className="font-display text-2xl md:text-4xl font-semibold text-white mt-2 mb-4 im-title-rule pb-4">
                  {INTRO.title}
                </h2>
                <p className="text-[14px] md:text-base leading-relaxed text-ink-secondary max-w-2xl">
                  {INTRO.description}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {INTRO.highlights.map(point => (
                    <li key={point} className="text-[13px] md:text-sm text-ink-primary leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:h-px before:w-2 before:bg-[#9AA0A8]/60">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>

            {filteredDossier.map((item, idx) => (
              <motion.article
                key={item.id}
                ref={node => {
                  sectionRefs.current[idx] = node
                }}
                data-dossier-id={item.id}
                data-snap-section
                animate={{ opacity: !onIntro && activeSection === item.id ? 1 : onIntro ? 0.55 : 0.5 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-h-[calc(100dvh-3.75rem)] shrink-0 snap-center items-center justify-center px-6 md:px-10 xl:px-16 py-10"
              >
                <div
                  className={`relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 lg:gap-12 xl:gap-16 items-center ${
                    item.compact ? 'lg:grid-cols-[1.15fr,0.85fr]' : 'lg:grid-cols-[1.32fr,0.68fr]'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <img
                      src={item.src}
                      alt={item.title}
                      className={`object-contain ${
                        item.compact ? 'h-[280px] w-auto max-w-full' : 'w-full max-h-[min(720px,68vh)]'
                      }`}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="flex flex-col justify-center gap-5 md:gap-6 mx-auto w-full max-w-md lg:max-w-none lg:mx-0">
                    <div>
                      <p className="text-[10px] tracking-[0.24em] text-[#9AA0A8]/80 uppercase tabular-nums mb-2">
                        {String(idx + 1).padStart(2, '0')} / {String(filteredDossier.length).padStart(2, '0')}
                      </p>
                      <h3 className="font-display text-2xl md:text-3xl font-semibold text-white pb-2 mb-3 im-title-rule">
                        {item.title}
                      </h3>
                      <p className="text-[13px] md:text-sm leading-relaxed text-ink-secondary">{item.description}</p>
                    </div>

                    <div>
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
                    </div>

                    <div>
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
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
