import { Cpu } from 'lucide-react'

/**
 * AXIOM “AI CPU” icon, matches Insurance Manager toolbar / model picker styling.
 * Lucide outline microchip, amber glow, subtle pulse. Use inside `.axiom-ai-cpu-btn`.
 */
export default function AiCpuIcon({ size = 14, strokeWidth = 1.75, className = '' }) {
  return (
    <span className={`axiom-ai-cpu ${className}`.trim()} aria-hidden>
      <Cpu className="axiom-ai-cpu__svg" size={size} strokeWidth={strokeWidth} />
    </span>
  )
}
