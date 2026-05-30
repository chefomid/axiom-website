export default function SectionTitle({ title, subtitle, badge }) {
  return (
    <div className="report-print-section-title-row">
      <h2 className="report-print-section-title">
        {title}
        {badge ? <span className="report-print-badge">{badge}</span> : null}
      </h2>
      {subtitle ? <p className="report-print-section-subtitle">{subtitle}</p> : null}
    </div>
  )
}
