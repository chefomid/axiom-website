import { motion } from 'framer-motion'
import { IconButton } from '../ui/CommandControls'
import { getMarkerReportUrl } from '../../utils/markerReportUrl'
import { containedPercent } from '../../utils/wildfireDisplay'

const CONTAINED_GRADIENT =
  'linear-gradient(to right, #8f4a48 0%, #a67a4a 25%, #a8884c 55%, #7a8f62 100%)'

function detailWithoutContained(detail) {
  return String(detail ?? '')
    .split(' · ')
    .filter(part => !/\d+(?:\.\d+)?%\s*contained/i.test(part))
    .join(' · ')
}

export default function RiskMarkerCard({ marker, onClose }) {
  if (!marker) return null

  const reportUrl = getMarkerReportUrl(marker)
  const containedPct = containedPercent(marker)

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="absolute bottom-4 right-4 z-20 w-[min(100%,320px)] rounded border border-[#333] bg-[#0d0d0d]/95 p-4 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">{marker.label}</p>
          <h3 className="font-display mt-1 text-base font-medium text-white">{marker.title}</h3>
        </div>
        <IconButton onClick={onClose} label="Close marker details">
          Close
        </IconButton>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
        {containedPct != null ? detailWithoutContained(marker.detail) : marker.detail}
      </p>
      {containedPct != null ? (
        <div className="mt-3">
          <p className="mb-1.5 font-mono text-[10px] tabular-nums text-ink-muted">
            {Math.round(containedPct)}% contained
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full border border-[#555] bg-[#3a3a3a]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(containedPct)}
            aria-label={`${Math.round(containedPct)} percent contained`}
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                background: CONTAINED_GRADIENT,
                clipPath: `inset(0 ${100 - containedPct}% 0 0)`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-1 border-t border-[#222] pt-3">
        <p className="font-mono text-[10px] text-ink-muted">Source: {marker.source}</p>
        {reportUrl ? (
          <a
            href={reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-mono text-[10px] text-command-live transition-colors hover:text-white"
          >
            → Open official source
          </a>
        ) : (
          <p className="font-mono text-[10px] text-command-live">→ {marker.action}</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`command-map-marker__dot command-map-marker__dot--${marker.severity} inline-block h-2 w-2 rounded-full`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          {marker.severity}
        </span>
      </div>
    </motion.div>
  )
}
