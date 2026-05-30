import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let cachedCss = null

function loadPdfCss() {
  if (cachedCss) return cachedCss
  cachedCss = readFileSync(join(__dirname, 'reportPdfStyles.css'), 'utf8')
  return cachedCss
}

function esc(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pageWrap(content) {
  return `<div class="report-page">${content}</div>`
}

function pageHeader(meta) {
  return `
    <header class="report-header">
      <div class="report-brand">${esc(meta.preparedBy)}</div>
      <div class="report-meta-right">
        <div>${esc(meta.title)}</div>
        <div>${esc(meta.generatedDate)}</div>
      </div>
    </header>
  `
}

function sectionTitle(title, subtitle = null) {
  const subtitleHtml = subtitle
    ? `<p class="report-section-subtitle">${esc(subtitle)}</p>`
    : ''
  return `
    <h2 class="report-section-title">${esc(title)}</h2>
    ${subtitleHtml}
  `
}

function parameterTable(rows) {
  const body = (rows ?? [])
    .map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}</td></tr>`)
    .join('')
  return `
    <table class="report-table">
      <thead><tr><th>Parameter</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `
}

function kpiGrid(kpis) {
  const cells = (kpis ?? [])
    .map(
      kpi => `
        <div class="report-kpi">
          <div class="report-kpi-label">${esc(kpi.label)}</div>
          <div class="report-kpi-value${kpi.highlight ? ' report-kpi-value--accent' : ''}">
            ${esc(kpi.value)}
          </div>
        </div>
      `,
    )
    .join('')
  return `<div class="report-kpi-grid">${cells}</div>`
}

function dataTable(table) {
  const columns = table.columns ?? ['Band', 'Value']
  const rows = table.rows ?? []
  if (!rows.length) return ''
  const head = columns
    .map((col, i) =>
      i ? `<th style="text-align:right">${esc(col)}</th>` : `<th>${esc(col)}</th>`,
    )
    .join('')
  const body = rows
    .map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}</td></tr>`)
    .join('')
  const unitHtml = table.unit
    ? `<div class="report-table-unit">Unit: ${esc(table.unit)}</div>`
    : ''
  return `
    <div class="report-section">
      <div class="report-table-caption">${esc(table.title)}</div>
      ${unitHtml}
      <table class="report-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `
}

function analysisSection(section) {
  const narrative = (section.narrative ?? [])
    .map(p => `<p class="report-body">${esc(p)}</p>`)
    .join('')
  const metrics = section.metrics ?? []
  let metricsHtml = ''
  if (metrics.length) {
    const cells = metrics
      .map(
        m => `
          <div class="report-metric-inline">
            <div class="report-metric-inline-label">${esc(m.label)}</div>
            <div class="report-metric-inline-value">${esc(m.value)}</div>
          </div>
        `,
      )
      .join('')
    metricsHtml = `<div class="report-metrics-inline">${cells}</div>`
  }
  const tableHtml = section.table ? dataTable(section.table) : ''
  return `
    <section class="report-section">
      ${sectionTitle(section.title)}
      ${narrative}
      ${metricsHtml}
      ${tableHtml}
    </section>
  `
}

export function renderReportHtml(document) {
  const meta = document.meta ?? {}
  const css = loadPdfCss()
  const pages = []

  if (document.noData) {
    pages.push(
      pageWrap(`
        <div class="report-cover-brand">${esc(meta.preparedBy)}</div>
        <h1 class="report-cover-title">${esc(meta.title)}</h1>
        <p class="report-cover-location">${esc(meta.location)}</p>
        <p class="report-body">${esc(document.noDataMessage)}</p>
      `),
    )
  } else {
    const execSummary = document.executiveSummary ?? {}
    const bullets = (execSummary.bullets ?? []).map(b => `<li>${esc(b)}</li>`).join('')
    const methodology = document.methodology ?? {}

    pages.push(
      pageWrap(`
        <div class="report-cover-brand">${esc(meta.preparedBy)} Intelligence</div>
        <h1 class="report-cover-title">${esc(meta.title)}</h1>
        <p class="report-cover-type">${esc(meta.type)}</p>
        <p class="report-cover-location">${esc(meta.location)}</p>
        <div class="report-cover-meta">
          <p><strong>Prepared by:</strong> ${esc(meta.preparedBy)}</p>
          <p><strong>Generated:</strong> ${esc(meta.generatedDate)}</p>
          <p><strong>Source:</strong> ${esc(meta.dataSource)}</p>
        </div>
        <div class="report-insight">
          <div class="report-insight-label">
            Executive summary
            <span class="report-badge">${esc(execSummary.activityLevel)}</span>
          </div>
          <p class="report-body">${esc(execSummary.headline)}</p>
          <p class="report-body">${esc(execSummary.meaning)}</p>
          <ul class="report-bullets">${bullets}</ul>
        </div>
      `),
    )

    pages.push(
      pageWrap(`
        ${pageHeader(meta)}
        ${sectionTitle('Search parameters', 'Catalog filters applied to this report.')}
        ${parameterTable(document.parameters)}
        <div class="report-section">
          ${sectionTitle('Key metrics', 'Summary indicators for the selected window.')}
          ${kpiGrid(document.kpis)}
        </div>
      `),
    )

    if (document.catalogTables?.length) {
      const tables = document.catalogTables.map(dataTable).join('')
      pages.push(
        pageWrap(`
          ${pageHeader(meta)}
          ${sectionTitle('Catalog analysis', 'USGS event counts for this report focus — tables include explicit units.')}
          ${tables}
        `),
      )
    }

    if (document.analysisSections?.length) {
      const sections = document.analysisSections.map(analysisSection).join('')
      pages.push(
        pageWrap(`
          ${pageHeader(meta)}
          ${sectionTitle('Detailed analysis', 'Section-specific findings from the USGS catalog.')}
          ${sections}
        `),
      )
    }

    const qualityNote = methodology.dataQualityNote
      ? `<p class="report-warn">${esc(methodology.dataQualityNote)}</p>`
      : ''

    pages.push(
      pageWrap(`
        ${pageHeader(meta)}
        ${sectionTitle('Data and limitations')}
        <div class="report-footer-block">
          <p><strong>Source:</strong> ${esc(methodology.source)}. Counts reflect published historical
          records for the selected magnitude threshold and time window.</p>
          <p>${esc(methodology.disclaimer)}</p>
          ${qualityNote}
        </div>
      `),
    )
  }

  const body = `<div id="report-print-ready">${pages.join('')}</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(meta.title)}</title>
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`
}
