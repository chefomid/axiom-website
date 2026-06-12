import ExcelJS from 'exceljs'

import { buildCopeReportDocument } from './copeReportDocument'

const THEME = {
  headerFill: 'FF080808',
  headerFont: 'FFFFFFFF',
  bodyFont: 'FF111111',
  bodyFill: 'FFFFFFFF',
  stripeFill: 'FFF5F5F5',
  border: 'FFD0D0D0',
  labelFill: 'FFF0F0F0',
}

const SECTION_ACCENTS = {
  C: 'FFD6E8FF',
  O: 'FFD9F5E8',
  P: 'FFFFF0D6',
  E: 'FFFDE0E0',
}

const COPE_COLUMNS = [
  { key: 'field', header: 'Field', width: 28 },
  { key: 'value', header: 'Value', width: 36 },
  { key: 'source', header: 'Source', width: 22 },
  { key: 'confidence', header: 'Confidence', width: 14 },
  { key: 'status', header: 'Status', width: 12 },
]


function slugifyLocation(label) {
  return String(label ?? 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function thinBorder(color = THEME.border) {
  const side = { style: 'thin', color: { argb: color } }
  return { top: side, left: side, bottom: side, right: side }
}

function applyHeaderRow(row) {
  row.height = 22
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerFill } }
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.headerFont } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder('FF333333')
  })
}

function applyBodyCell(cell, { stripe = false, center = false, mono = false } = {}) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: stripe ? THEME.stripeFill : THEME.bodyFill },
  }
  cell.font = {
    name: mono ? 'Consolas' : 'Calibri',
    size: 10,
    color: { argb: THEME.bodyFont },
  }
  cell.alignment = {
    vertical: 'top',
    horizontal: center ? 'center' : 'left',
    wrapText: true,
  }
  cell.border = thinBorder()
}

function applySectionHeader(row, accentArgb) {
  row.height = 24
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentArgb } }
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.bodyFont } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = thinBorder()
  })
}

function sectionAccent(section) {
  const letter = String(section?.cope_letter ?? section?.label ?? 'C')
    .trim()
    .charAt(0)
    .toUpperCase()
  return SECTION_ACCENTS[letter] ?? SECTION_ACCENTS.C
}

function fieldDisplayValue(field) {
  if (field?.value != null && field.value !== '') return String(field.value)
  if (field?.note) return String(field.note)
  return 'Unknown'
}

function buildSummarySheet(workbook, doc) {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ showGridLines: false }],
    properties: { defaultColWidth: 18 },
  })

  sheet.columns = [
    { width: 22 },
    { width: 52 },
  ]

  const meta = doc.meta ?? {}
  const score = doc.copeScore ?? {}

  const titleRow = sheet.addRow([meta.preparedBy ?? 'AXIOM Property & Casualty'])
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 2)
  titleRow.height = 28
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerFill } }
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: THEME.headerFont } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const subtitleRow = sheet.addRow([meta.title ?? 'COPE Underwriting Dossier'])
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, 2)
  subtitleRow.height = 22
  subtitleRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.bodyFont } }
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  sheet.addRow([])

  const metadata = [
    ['Location', meta.location ?? '-'],
    ['Report ID', meta.reportId ?? '-'],
    ['Generated', meta.generatedDate ?? '-'],
    ['Data source', meta.dataSource ?? 'AXIOM Property Intelligence'],
  ]
  if (meta.visionIsoClass || meta.visionIsoLabel) {
    metadata.push([
      'Image ISO estimate',
      [meta.visionIsoClass, meta.visionIsoLabel].filter(Boolean).join(', ') || '-',
    ])
  }
  if (meta.visionDisclaimer) {
    metadata.push(['Image analysis note', meta.visionDisclaimer])
  }

  for (const [label, value] of metadata) {
    const row = sheet.addRow([label, value])
    row.height = 20
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.labelFill } }
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.bodyFont } }
    row.getCell(1).border = thinBorder()
    row.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: THEME.bodyFont } }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(2).border = thinBorder()
  }

  sheet.addRow([])

  const kpiHeader = sheet.addRow(['COPE completeness'])
  sheet.mergeCells(kpiHeader.number, 1, kpiHeader.number, 2)
  applySectionHeader(kpiHeader, SECTION_ACCENTS.C)

  const kpis = [
    ['Completeness', `${score.completeness_pct ?? 0}%`],
    ['Observed fields', String(score.observed ?? 0)],
    ['Unknown fields', String(score.unknown ?? 0)],
    ['Total fields', String(score.total ?? 0)],
  ]

  kpis.forEach(([label, value], index) => {
    const row = sheet.addRow([label, value])
    row.height = 20
    applyBodyCell(row.getCell(1), { stripe: index % 2 === 1 })
    applyBodyCell(row.getCell(2), { stripe: index % 2 === 1, center: true })
    row.getCell(1).font = { ...row.getCell(1).font, bold: true }
  })

  sheet.addRow([])

  const footerRow = sheet.addRow(['Generated by AXIOM Property Intelligence'])
  sheet.mergeCells(footerRow.number, 1, footerRow.number, 2)
  footerRow.getCell(1).font = {
    name: 'Calibri',
    size: 9,
    italic: true,
    color: { argb: 'FF666666' },
  }
}

function buildCopeSheet(workbook, doc) {
  const sheet = workbook.addWorksheet('COPE', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  })

  sheet.columns = COPE_COLUMNS.map(col => ({ key: col.key, width: col.width }))

  const headerRow = sheet.addRow(COPE_COLUMNS.map(col => col.header))
  applyHeaderRow(headerRow)

  let rowIndex = 0

  for (const section of doc.copeSections ?? []) {
    const sectionLabel = section.cope_letter
      ? `${section.cope_letter}, ${section.label ?? section.id ?? 'Section'}`
      : section.label ?? section.id ?? 'Section'

    const sectionRow = sheet.addRow([sectionLabel, '', '', '', ''])
    sheet.mergeCells(sectionRow.number, 1, sectionRow.number, COPE_COLUMNS.length)
    applySectionHeader(sectionRow, sectionAccent(section))

    const completeness = section.completeness ? ` (${section.completeness})` : ''
    sectionRow.getCell(1).value = `${sectionLabel}${completeness}`

    for (const field of section.fields ?? []) {
      const dataRow = sheet.addRow([
        field.label ?? field.id ?? '',
        fieldDisplayValue(field),
        field.source ?? '-',
        field.confidence ?? 'unknown',
        field.status ?? 'unknown',
      ])
      dataRow.height = 18
      const stripe = rowIndex % 2 === 1
      applyBodyCell(dataRow.getCell(1), { stripe })
      applyBodyCell(dataRow.getCell(2), { stripe, mono: true })
      applyBodyCell(dataRow.getCell(3), { stripe })
      applyBodyCell(dataRow.getCell(4), { stripe, center: true })
      applyBodyCell(dataRow.getCell(5), { stripe, center: true })
      rowIndex += 1
    }

    sheet.addRow([])
  }
}

export async function buildCopeExcelWorkbook(doc) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = doc.meta?.preparedBy ?? 'AXIOM Property Intelligence'
  workbook.created = new Date()
  workbook.modified = new Date()

  buildSummarySheet(workbook, doc)
  buildCopeSheet(workbook, doc)

  return workbook
}

function saveExcelBlob(buffer, locationLabel, prefix = 'cope-report') {
  const slug = slugifyLocation(locationLabel) || 'location'
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${prefix}-${slug}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Build workbook from report document and trigger browser download. */
export async function downloadCopeExcel(doc, locationLabel, { prefix = 'cope-report' } = {}) {
  const workbook = await buildCopeExcelWorkbook(doc)
  const buffer = await workbook.xlsx.writeBuffer()
  if (!buffer?.byteLength) {
    throw new Error('Excel export returned an empty file.')
  }
  saveExcelBlob(buffer, locationLabel, prefix)
}

/** Convenience: build document from enrich record, then download. */
export async function downloadCopeExcelFromRecord(record, locationLabel, { prefix = 'cope-report' } = {}) {
  const doc = buildCopeReportDocument(record)
  await downloadCopeExcel(doc, locationLabel, { prefix })
}
