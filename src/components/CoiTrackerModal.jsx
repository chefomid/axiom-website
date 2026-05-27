import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
const PLATFORM_SECTIONS = [
  {
    title: 'Portfolio Onboarding',
    body: 'Rent rolls, leases, and coverage requirements live in one portfolio view. Lease language can inform compliance rules so onboarding moves faster across properties.',
  },
  {
    title: 'Enterprise Email Platform',
    body: 'Nylas connects landlord email with tenant threads and certificate history in one place. Outbound outreach, replies, and inbound COIs stay tied to each tenant record.',
  },
  {
    title: 'Compliance & Reporting',
    body: 'Certificates are checked against your requirements, gaps are tracked to close, and portfolio reporting gives leadership and audit teams a current view without rebuilding spreadsheets.',
  },
]

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
  const scrollRef = useRef(null)
  const sectionRefs = useRef([])
  const filteredDossier = useMemo(() => DOSSIER, [])
  useEffect(() => {
    if (!open) return
    setActiveSection(DOSSIER[0]?.id || 1)
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
          key="coi-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-xl flex flex-col"
        >
          <div className="flex items-center justify-between px-8 md:px-14 pt-7 pb-5 relative z-10 border-b border-[#141414]">
            <div>
              <p className="font-display text-xl md:text-2xl font-semibold text-white tracking-[0.08em] uppercase">
                COI Tracker
              </p>
              <p className="text-[10px] tracking-[0.24em] text-ink-faint uppercase mt-1">
                Autonomous Certificate Intelligence Dossier
              </p>
            </div>
            <div className="flex items-center gap-6">
              <span className="font-display text-[10px] text-ink-faint tabular-nums tracking-[0.3em]">
                {String(filteredDossier.findIndex(item => item.id === activeSection) + 1).padStart(2, '0')} / {String(filteredDossier.length).padStart(2, '0')}
              </span>
              <a
                href="/coi-tracker/COI-Tracker-Booklet.pdf"
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
            </div>
          </div>

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
                  <p className="text-[9px] tracking-[0.22em] text-ink-muted uppercase">COI Tracker</p>
                  <h2 className="font-display text-lg text-white leading-tight mt-1.5">
                    Commercial COI compliance on one platform.
                  </h2>
                  <p className="text-xs text-ink-secondary leading-snug mt-2">
                    Portfolio onboarding, tenant email, certificate validation, and reporting without switching tools.
                  </p>
                </div>

                <div className="flex-1 flex flex-col justify-evenly py-4 min-h-0">
                  {PLATFORM_SECTIONS.map(section => (
                    <div key={section.title}>
                      <p className="text-[14px] font-medium text-white pb-1.5 mb-2 border-b border-[#2d2d2d]">
                        {section.title}
                      </p>
                      <p className="text-xs text-ink-secondary leading-relaxed">{section.body}</p>
                    </div>
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
                    activeSection === item.id
                      ? 'border-[#8d8d8d] bg-[#161616]'
                      : 'border-[#2d2d2d] bg-[#121212]'
                  }`}
                >
                  <div className={`grid grid-cols-1 gap-0 ${
                    item.compact ? '2xl:grid-cols-[0.82fr,1.18fr]' : '2xl:grid-cols-[1.16fr,0.84fr]'
                  }`}>
                    <div className={`bg-[#151515] ${item.compact ? 'p-6 md:p-8' : 'p-5 md:p-7'}`}>
                      <div className={`rounded-lg border border-[#303030] bg-[#111111] p-2 flex items-center justify-center ${
                        item.compact
                          ? 'min-h-[260px] w-fit max-w-[360px] mx-auto'
                          : 'min-h-[390px] w-full'
                      }`}>
                        <img
                          src={item.src}
                          alt={item.title}
                          className={`object-contain ${
                            item.compact ? 'h-[240px] w-auto max-w-full' : 'w-full max-h-[520px]'
                          }`}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <div className="border-l border-[#2a2a2a] p-5 md:p-7">
                      <h3 className="font-display text-xl md:text-2xl font-semibold text-white pb-2 mb-2 border-b border-[#2d2d2d]">
                        {item.title}
                      </h3>
                      <p className="text-[11px] leading-relaxed text-ink-secondary">{item.description}</p>

                      <div className="mt-5">
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
                      </div>

                      <div className="mt-5 pt-4 border-t border-[#2d2d2d]">
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
                      </div>
                    </div>
                  </div>
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
