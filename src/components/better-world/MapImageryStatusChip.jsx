export default function MapImageryStatusChip({ message = 'Imagery' }) {
  return (
    <div
      className="pointer-events-none absolute bottom-14 left-3 z-20 rounded border border-[#333] bg-[#0d0d0d]/92 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center font-mono text-[9px] uppercase tracking-[0.18em] text-ink-secondary">
        <span>{message}</span>
        <span className="eq-loading-dots inline-flex w-[1.1rem]" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
