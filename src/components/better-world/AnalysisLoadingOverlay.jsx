export default function AnalysisLoadingOverlay() {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="rounded border border-[#333] bg-[#0d0d0d]/95 px-3 py-2 shadow-lg">
        <p className="flex items-center font-mono text-[10px] uppercase tracking-[0.22em] text-ink-secondary">
          <span>LOADING</span>
          <span className="eq-loading-dots inline-flex w-[1.15rem]" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    </div>
  )
}