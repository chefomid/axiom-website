import { motion } from 'framer-motion'

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] },
  }),
}

const themes = [
  {
    label: 'Biology',
    title: 'The Living World',
    body: 'A healthier planet is the foundation of everything else. Sustainable futures require systems that protect biodiversity and treat the natural world as a stakeholder in every decision made. Current AI and computing infrastructure carries a real environmental cost. Reducing that footprint is an active area of research, here and across the industry, and one AXIOM takes seriously, alongside pathways that can enable regenerative outcomes. AXIOM is in the research phase of developing technology aimed at lowering the environmental cost of intelligent systems.',
  },
  {
    label: 'Humanity',
    title: 'Human Well-Being',
    body: 'We are part of the living world, not apart from it. Billions live without reliable access to clean water, food, electricity, or economic opportunity. Bridging that gap requires more than technology. It requires financing, agricultural solutions, resilient infrastructure, and a commitment to gender equality and community-driven self-sufficiency, both domestically and across the globe. AXIOM is actively researching across these areas, working toward solutions that reach the people current systems have not.',
  },
  {
    label: 'The Future',
    title: 'For the Next Generation',
    body: 'Future generations should be healthier, more prosperous, and less burdened than those who came before. That is the standard against which this work is measured. AXIOM is in the early research phase of working toward that standard, with the systems and solutions future generations will rely on as the long-term goal.',
  },
]

export default function VisionTab() {
  return (
    <>
      <section className="flex flex-col justify-center min-h-[calc(100vh-8rem)] px-8 md:px-20 max-w-5xl mx-auto pt-24">
        <motion.p
          variants={fade}
          initial="hidden"
          animate="show"
          custom={0}
          className="text-xs tracking-[0.3em] text-ink-muted uppercase mb-8"
        >
          Beyond Technology
        </motion.p>

        <motion.h1
          variants={fade}
          initial="hidden"
          animate="show"
          custom={1}
          className="font-display text-3xl md:text-5xl font-semibold leading-[1.1] tracking-tight text-white mb-8"
        >
          A Better World
        </motion.h1>

        <motion.p
          variants={fade}
          initial="hidden"
          animate="show"
          custom={2}
          className="text-ink-secondary text-lg leading-relaxed max-w-xl"
        >
          A better world is not only more advanced; it is more capable, more self-sufficient, and less fragile. It is a world where people are equipped to strengthen themselves, organizations are strengthened by the people within them, and technology is judged by whether it helps life, work, and society endure.
        </motion.p>

        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-16 w-16 h-px bg-[#333]"
        />
      </section>

      <div className="px-8 md:px-20 max-w-5xl mx-auto pb-32">
        {themes.map((t, i) => (
          <motion.div
            key={t.label}
            variants={fade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={i}
            className="grid md:grid-cols-2 gap-20 items-start py-16 border-t border-[#141414]"
          >
            <div className="flex flex-col gap-3">
              <p className="text-xs tracking-[0.3em] text-ink-muted uppercase">{t.label}</p>
              <h2 className="font-display text-xl font-medium text-white">{t.title}</h2>
            </div>
            <p className="text-ink-secondary text-base leading-relaxed">{t.body}</p>
          </motion.div>
        ))}

        <motion.div
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="py-24 border-t border-[#141414]"
        >
          <p className="font-display text-2xl md:text-3xl font-medium text-ink-secondary leading-snug max-w-2xl">
            This is the world AXIOM is building toward.
          </p>
        </motion.div>
      </div>

      <footer className="px-8 md:px-20 py-12 border-t border-[#141414] flex items-center justify-between">
        <span className="font-display text-xs tracking-[0.2em] text-ink-faint">AXIOM</span>
        <span className="text-xs text-ink-faint">© 2026</span>
      </footer>
    </>
  )
}
