import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import CoiTrackerModal from '../components/CoiTrackerModal'
import InsuranceManagerModal from '../components/InsuranceManagerModal'
import {
  PROPERTY_INTELLIGENCE_LABEL,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_LABEL,
  PUBLIC_DATA_COMMAND_PATH,
} from '../constants/routes'

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] },
  }),
}

function CardOpenArrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="block shrink-0"
    >
      <path
        d="M4.5 9.5L9.5 4.5M9.5 4.5H5.75M9.5 4.5V8.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AbstractBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-44 -left-24 h-[32rem] w-[32rem] rounded-full bg-white/[0.04] blur-3xl" />
      <div className="absolute top-[18%] -right-32 h-[28rem] w-[28rem] rounded-full bg-slate-200/[0.04] blur-3xl" />
      <div className="absolute bottom-[12%] left-[35%] h-[20rem] w-[20rem] rounded-full bg-white/[0.03] blur-3xl" />

      <motion.div
        initial={{ opacity: 0.16 }}
        animate={{ opacity: [0.08, 0.16, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[6%] top-[14%] h-px w-[50%] bg-gradient-to-r from-white/5 via-white/20 to-white/5 rotate-[12deg]"
      />
      <motion.div
        initial={{ opacity: 0.14 }}
        animate={{ opacity: [0.12, 0.2, 0.1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[19%] top-[22%] h-px w-[58%] bg-gradient-to-r from-white/5 via-white/15 to-white/5 -rotate-[8deg]"
      />
      <motion.div
        initial={{ opacity: 0.13 }}
        animate={{ opacity: [0.1, 0.18, 0.08] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[8%] top-[54%] h-px w-[66%] bg-gradient-to-r from-white/5 via-white/12 to-white/5 rotate-[4deg]"
      />

      <svg className="absolute inset-0 h-full w-full opacity-35" viewBox="0 0 1600 1400" fill="none" preserveAspectRatio="none">
        <path d="M-140 220 C 180 120, 520 420, 900 280 C 1210 170, 1500 320, 1760 220" stroke="white" strokeOpacity="0.12" strokeWidth="1.2" />
        <path d="M-180 680 C 220 500, 620 860, 1080 640 C 1320 530, 1560 690, 1780 570" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      </svg>
    </div>
  )
}

export default function Home() {
  const [coiOpen, setCoiOpen] = useState(false)
  const [insuranceManagerOpen, setInsuranceManagerOpen] = useState(false)

  useEffect(() => {
    document.body.classList.add('home-snap')
    return () => document.body.classList.remove('home-snap')
  }, [])

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-black text-ink-primary font-sans">
      <AbstractBackground />
      <Nav />
      <Hero />
      <Pillars
        onOpenCoi={() => setCoiOpen(true)}
        onOpenInsuranceManager={() => setInsuranceManagerOpen(true)}
      />
      <Thesis />
      <SiteFooter />
      <CoiTrackerModal open={coiOpen} onClose={() => setCoiOpen(false)} />
      <InsuranceManagerModal
        open={insuranceManagerOpen}
        onClose={() => setInsuranceManagerOpen(false)}
      />
    </div>
  )
}


function Hero() {
  return (
    <section data-snap-section className="flex flex-col justify-center min-h-screen px-8 pt-28 sm:pt-32 md:px-20 max-w-5xl mx-auto">
      <motion.h1
        variants={fade}
        initial="hidden"
        animate="show"
        custom={0}
        className="font-display text-3xl md:text-5xl font-semibold leading-[1.1] tracking-tight text-white mb-8"
      >
        Intelligent Systems for Holistic Enterprise Risk Management
      </motion.h1>

      <motion.p
        variants={fade}
        initial="hidden"
        animate="show"
        custom={1}
        className="text-ink-muted text-base leading-relaxed max-w-3xl"
      >
        AXIOM is a research and development initiative building next-generation software and hardware systems for property and casualty risk management. Its work spans intelligent software, connected hardware, edge computing, and automation, all designed to function as one connected risk intelligence ecosystem.
      </motion.p>

      <motion.p
        variants={fade}
        initial="hidden"
        animate="show"
        custom={2}
        className="text-ink-muted text-base leading-relaxed max-w-3xl mt-6"
      >
        AXIOM&apos;s purpose is to move risk management beyond administration. By unifying digital intelligence, physical technology, emerging technologies, and operational insight, AXIOM aims to help organizations understand their exposures more clearly, strengthen protection, and make faster, more confident decisions across their operations.
      </motion.p>

      <motion.div
        variants={fade}
        initial="hidden"
        animate="show"
        custom={3}
        className="mt-10 flex flex-col gap-3 md:hidden"
      >
        <Link
          to={PUBLIC_DATA_COMMAND_PATH}
          className="flex min-h-[44px] items-center justify-center rounded border border-[#3a3a3a] bg-[#141414] px-5 font-display text-sm font-medium text-white transition-colors hover:border-[#5c5c5c] hover:bg-[#1a1a1a]"
        >
          {PUBLIC_DATA_COMMAND_LABEL}
        </Link>
        <Link
          to={PROPERTY_INTELLIGENCE_PATH}
          className="flex min-h-[44px] items-center justify-center rounded border border-[#2d2d2d] bg-transparent px-5 font-display text-sm font-medium text-ink-secondary transition-colors hover:border-[#444] hover:text-white"
        >
          {PROPERTY_INTELLIGENCE_LABEL}
        </Link>
      </motion.div>

      <motion.div
        variants={fade}
        initial="hidden"
        animate="show"
        custom={4}
        className="mt-16 w-16 h-px bg-[#333]"
      />
    </section>
  )
}

function Pillars({ onOpenCoi, onOpenInsuranceManager }) {
  const pillars = [
    {
      label: '01',
      title: 'Property & Casualty Intelligence',
      body: 'Software that parses insurance programs, locates points of exposure, and deploys autonomous agents to enforce broker accountability across accuracy, gaps, and omissions. One of several tools in active development, each engineered to operate independently across the full coverage lifecycle. Architected to price below existing insurance software through economies of scale and infrastructure built for efficiency from the ground up.',
      tools: [
        {
          name: 'Insurance Manager',
          description: 'Policy and exposure intelligence. Tracks endorsements, parses contracts for review, surfaces coverage gaps and E&O exposure, and enforces broker accountability for accuracy.',
          onClick: onOpenInsuranceManager,
        },
        {
          name: 'COI Tracker',
          description: 'Autonomous certificate intelligence. Batch parses COIs, matches policies to properties and tenants, flags non-compliance with structured assessment notes, and runs an autonomous mailroom that drafts, sends, and tracks tenant threads.',
          onClick: onOpenCoi,
        },
      ],
    },
    {
      label: '02',
      title: 'Edge AI',
      body: "Edge AI solutions are custom to the insured's operations. Hardware that captures vision, audio, and environmental data, processes it on-device through proprietary fine-tuned models, and streams to the AXIOM software stack in real time.",
    },
  ]

  return (
    <section data-snap-section id="pillars" className="px-8 md:px-20 py-20 sm:py-32 max-w-5xl mx-auto">
      <motion.p
        variants={fade}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="text-xs tracking-[0.3em] text-ink-muted uppercase mb-6"
      >
        Technology
      </motion.p>

      <motion.p
        variants={fade}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        custom={1}
        className="text-ink-muted text-base leading-relaxed max-w-xl mb-16"
      >
        Each system operates independently. Together they form a unified
        intelligence stack, modular by design and configurable to any deployment.
      </motion.p>

      <div className="grid grid-cols-1 gap-px bg-[#1a1a1a]">
        {pillars.map((p, i) => (
          <motion.div
            key={p.label}
            variants={fade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={i}
            className="bg-[#080808] py-6 sm:py-10 flex flex-col gap-6"
          >
            <span className="text-xs text-ink-muted font-display">{p.label}</span>
            <h2 className="font-display text-xl font-medium text-white leading-snug">
              {p.title}
            </h2>
            <p className="text-ink-muted text-base leading-relaxed">{p.body}</p>
            {p.tools && (
              <div className="flex flex-col gap-4 border-t border-[#2a2a2a] mt-2 pt-6">
                <span className="text-xs font-semibold tracking-[0.2em] text-white uppercase pb-1.5 border-b border-[#2d2d2d]">
                  Included Services
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {p.tools.map(t => {
                    const Tag = t.onClick ? 'button' : 'div'
                    return (
                      <Tag
                        key={t.name}
                        onClick={t.onClick}
                        className={`group flex min-h-[120px] flex-col gap-2.5 rounded-lg border p-4 text-left transition-colors sm:min-h-0 ${
                          t.onClick
                            ? 'cursor-pointer border-[#3a3a3a] bg-[#141414] hover:border-[#5c5c5c] hover:bg-[#1a1a1a] active:scale-[0.99]'
                            : 'border-[#2d2d2d] bg-[#111111]'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2 border-b border-[#2d2d2d] pb-2 font-display text-sm font-semibold text-white">
                          {t.name}
                          {t.onClick && (
                            <span className="shrink-0 text-ink-faint transition-colors group-hover:text-white">
                              <CardOpenArrow />
                            </span>
                          )}
                        </span>
                        <p className="text-xs leading-relaxed text-ink-muted sm:text-[11px]">{t.description}</p>
                        {t.onClick && (
                          <span className="mt-auto pt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#9AA0A8] sm:hidden">
                            Tap to explore
                          </span>
                        )}
                      </Tag>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function Thesis() {
  return (
    <section data-snap-section id="thesis" className="px-8 md:px-20 py-20 sm:py-32 max-w-5xl mx-auto border-t border-[#141414]">
      <div className="grid md:grid-cols-2 gap-20 items-center">
        <motion.p
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-xs tracking-[0.3em] text-ink-muted uppercase"
        >
          Thesis
        </motion.p>

        <motion.p
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          custom={1}
          className="text-ink-muted text-base leading-relaxed"
        >
          Enterprise risk is the terrain through which every organization must
          grow. Navigating it with full awareness, across every layer of the
          environment, is what allows organizations to pursue their objectives
          responsibly and with confidence. That clarity does not emerge from any
          single tool. It requires an ecosystem.
        </motion.p>
      </div>
    </section>
  )
}

