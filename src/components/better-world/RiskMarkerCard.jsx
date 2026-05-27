import { motion } from 'framer-motion'
import { IconButton } from '../ui/CommandControls'
import { getMarkerReportUrl } from '../../utils/markerReportUrl'

export default function RiskMarkerCard({ marker, onClose }) {
  if (!marker) return null

  const reportUrl = getMarkerReportUrl(marker)

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

      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{marker.detail}</p>

      <div className="mt-3 space-y-1 border-t border-[#222] pt-3">
        <p className="font-mono text-[10px] text-ink-muted">
          Source: {marker.source} · Confidence: {marker.confidence}%
        </p>
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
