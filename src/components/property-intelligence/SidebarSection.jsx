const TONE_STYLES = {

  live: {

    card: 'border-l-command-live/70 bg-[#0c1018]',

    divider: 'border-command-live/20',

    header: 'bg-command-live/[0.08]',

    dot: 'bg-command-live',

  },

  stable: {

    card: 'border-l-command-stable/70 bg-[#0c1210]',

    divider: 'border-command-stable/20',

    header: 'bg-command-stable/[0.08]',

    dot: 'bg-command-stable',

  },

  watch: {

    card: 'border-l-command-watch/70 bg-[#12100c]',

    divider: 'border-command-watch/20',

    header: 'bg-command-watch/[0.08]',

    dot: 'bg-command-watch',

  },

  neutral: {

    card: 'border-l-white/30 bg-[#101010]',

    divider: 'border-panel-border/60',

    header: 'bg-white/[0.04]',

    dot: 'bg-white/50',

  },

}



export default function SidebarSection({

  title,

  subtitle,

  tone = 'neutral',

  children,

  className = '',

  headerAction = null,

  noBodyPadding = false,

  compact = false,

  variant = 'default',

}) {

  const styles = TONE_STYLES[tone] ?? TONE_STYLES.neutral

  const isPremium = variant === 'premium'



  const headerPad = isPremium ? 'px-4 py-3' : compact ? 'px-3 py-2' : 'px-4 py-3'

  const bodyPad = noBodyPadding ? '' : isPremium ? 'px-4 py-4' : compact ? 'px-3 py-2.5' : 'px-4 py-4'



  const cardClass = `overflow-hidden rounded-md border border-panel-border/80 border-l-[3px] ${styles.card}`



  const titleClass = 'font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white'

  const subtitleClass = 'mt-0.5 truncate font-mono text-[9px] text-ink-muted'



  return (

    <section className={`flex min-h-0 flex-col ${cardClass} ${className}`}>

      <header className={`shrink-0 border-b ${headerPad} ${styles.divider} ${styles.header}`}>

        <div className="flex items-center justify-between gap-2">

          <div className="flex min-w-0 items-center gap-2">

            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden />

            <div className="min-w-0">

              <h2 className={titleClass}>{title}</h2>

              {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}

            </div>

          </div>

          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}

        </div>

      </header>

      <div className={`min-h-0 ${noBodyPadding ? 'flex flex-1 flex-col' : ''} ${bodyPad}`}>{children}</div>

    </section>

  )

}


