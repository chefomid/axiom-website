import DataTable from './DataTable'
import KpiGrid from './KpiGrid'
import ParameterTable from './ParameterTable'
import SectionTitle from './SectionTitle'

function PageHeader({ meta }) {
  return (
    <header className="report-print-header">
      <div className="report-print-brand">{meta.preparedBy}</div>
      <div className="report-print-meta-right">
        <div>{meta.title}</div>
        <div>{meta.generatedDate}</div>
      </div>
    </header>
  )
}

function AnalysisSectionBlock({ section }) {
  return (
    <section className="report-print-section">
      <SectionTitle title={section.title} />
      {section.narrative?.map(p => (
        <p key={p} className="report-print-body">
          {p}
        </p>
      ))}
      {section.metrics?.length ? (
        <div className="report-print-metrics-inline">
          {section.metrics.map(m => (
            <div key={m.id} className="report-print-metric-inline">
              <div className="report-print-metric-inline-label">{m.label}</div>
              <div className="report-print-metric-inline-value">{m.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {section.table ? <DataTable table={section.table} /> : null}
    </section>
  )
}

export default function ReportPrintDocument({ document: doc }) {
  if (!doc) return null

  if (doc.noData) {
    return (
      <div className="report-print-root report-print-root--embedded" id="report-print-ready">
        <div className="report-print-page">
          <div className="report-print-cover-brand">{doc.meta.preparedBy}</div>
          <h1 className="report-print-cover-title">{doc.meta.title}</h1>
          <p className="report-print-cover-location">{doc.meta.location}</p>
          <p className="report-print-body">{doc.noDataMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="report-print-root report-print-root--embedded" id="report-print-ready">
      {/* Page 1: Cover + executive summary */}
      <div className="report-print-page">
        <div className="report-print-cover-brand">{doc.meta.preparedBy} Intelligence</div>
        <h1 className="report-print-cover-title">{doc.meta.title}</h1>
        <p className="report-print-cover-type">{doc.meta.type}</p>
        <p className="report-print-cover-location">{doc.meta.location}</p>
        <div className="report-print-cover-meta">
          <p>
            <strong>Prepared by:</strong> {doc.meta.preparedBy}
          </p>
          <p>
            <strong>Generated:</strong> {doc.meta.generatedDate}
          </p>
          <p>
            <strong>Source:</strong> {doc.meta.dataSource}
          </p>
        </div>

        <div className="report-print-insight">
          <div className="report-print-insight-label">
            Executive summary
            <span className="report-print-badge">{doc.executiveSummary.activityLevel}</span>
          </div>
          <p className="report-print-body">{doc.executiveSummary.headline}</p>
          <p className="report-print-body">{doc.executiveSummary.meaning}</p>
          <ul className="report-print-bullets">
            {doc.executiveSummary.bullets.map(b => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Page 2: Parameters + KPIs */}
      <div className="report-print-page">
        <PageHeader meta={doc.meta} />
        <SectionTitle title="Search parameters" subtitle="Catalog filters applied to this report." />
        <ParameterTable rows={doc.parameters} />

        <div className="report-print-section">
          <SectionTitle title="Key metrics" subtitle="Summary indicators for the selected window." />
          <KpiGrid kpis={doc.kpis} />
        </div>
      </div>

      {/* Page 3: Catalog tables */}
      {doc.catalogTables?.length ? (
        <div className="report-print-page">
          <PageHeader meta={doc.meta} />
          <SectionTitle
            title="Catalog analysis"
            subtitle="USGS event counts for this report focus, tables include explicit units."
          />
          {doc.catalogTables.map(table => (
            <DataTable key={table.id} table={table} />
          ))}
        </div>
      ) : null}

      {/* Analysis sections, split across pages if many */}
      {doc.analysisSections?.length ? (
        <div className="report-print-page">
          <PageHeader meta={doc.meta} />
          <SectionTitle title="Detailed analysis" subtitle="Section-specific findings from the USGS catalog." />
          {doc.analysisSections.map(section => (
            <AnalysisSectionBlock key={section.id} section={section} />
          ))}
        </div>
      ) : null}

      {/* Methodology */}
      <div className="report-print-page">
        <PageHeader meta={doc.meta} />
        <SectionTitle title="Data and limitations" />
        <div className="report-print-footer-block">
          <p>
            <strong>Source:</strong> {doc.methodology.source}. Counts reflect published historical
            records for the selected magnitude threshold and time window.
          </p>
          <p>{doc.methodology.disclaimer}</p>
          {doc.methodology.dataQualityNote ? (
            <p className="report-print-warn">{doc.methodology.dataQualityNote}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
