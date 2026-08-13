import { useId } from 'react'

/** Small fire glyph for wildfire layer chips (matches map icon style). */
export default function WildfireFlameIcon({ className = 'h-2.5 w-2.5', active = true }) {
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`shrink-0 ${className}`}
      style={{ opacity: active ? 1 : 0.55 }}
    >
      <defs>
        <linearGradient id={gid} x1="8" y1="1" x2="8" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe566" />
          <stop offset="0.45" stopColor="#ff9a1f" />
          <stop offset="1" stopColor="#e05252" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M8 1.2c2.2 2.1 3.6 4.1 3.6 6.4 0 2.4-1.5 4.4-3.6 4.4S4.4 10 4.4 7.6C4.4 5.3 5.8 3.3 8 1.2z"
      />
      <path
        fill="#fff3a8"
        d="M8 6.2c.9.8 1.35 1.6 1.35 2.4 0 .9-.55 1.6-1.35 1.6S6.65 9.5 6.65 8.6c0-.8.45-1.6 1.35-2.4z"
      />
    </svg>
  )
}
