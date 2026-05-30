export default function ReportGeneratingIndicator({ label = 'Generating' }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24">
      <p className="flex items-center gap-1 font-mono text-[12px] tracking-wide text-ink-secondary">
        <span>{label}</span>
        <span className="eq-loading-dots inline-flex w-[1.25rem]" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}
