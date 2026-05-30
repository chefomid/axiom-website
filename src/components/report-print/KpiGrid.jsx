export default function KpiGrid({ kpis }) {
  if (!kpis?.length) return null

  return (
    <div className="report-print-kpi-grid">
      {kpis.map(kpi => (
        <div key={kpi.id} className="report-print-kpi">
          <div className="report-print-kpi-label">{kpi.label}</div>
          <div
            className={`report-print-kpi-value ${kpi.highlight ? 'report-print-kpi-value--accent' : ''}`}
          >
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  )
}
