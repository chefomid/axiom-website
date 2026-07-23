import ExcelJS from 'exceljs'

import { buildCopeReportDocument } from './copeReportDocument'
import { formatCopeSourceLabel } from './copeSourceLabels'

/** AXIOM dossier palette: black / paper white / command orange */
const THEME = {
  black: 'FF080808',
  paper: 'FFF6F6F4',
  white: 'FFFFFFFF',
  ink: 'FF141414',
  inkMuted: 'FF5A5A5A',
  border: 'FFD6D6D2',
  orange: 'FFE8A838',
  orangeWash: 'FFFFF1D6',
  stripe: 'FFF0F0EE',
  labelFill: 'FFEFEEEC',
}

const SECTION_ACCENTS = {
  C: 'FFFFF1D6',
  O: 'FFFFF1D6',
  P: 'FFFFF1D6',
  E: 'FFFFF1D6',
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.black } }
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.white } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = thinBorder(THEME.black)
  })
}

function applyBodyCell(cell, { stripe = false, center = false, mono = false } = {}) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: stripe ? THEME.stripe : THEME.white },
  }
  cell.font = {
    name: mono ? 'Consolas' : 'Calibri',
    size: 10,
    color: { argb: THEME.ink },
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
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.ink } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = thinBorder()
  })
}

function sectionAccent(section) {
  const letter = String(section?.cope_letter ?? section?.label ?? 'C')
    .trim()
    .charAt(0)
    .toUpperCase()
  return SECTION_ACCENTS[letter] ?? THEME.orangeWash
}

function fieldDisplayValue(field) {
  if (field?.value != null && field.value !== '') return String(field.value)
  if (field?.note) return String(field.note)
  return 'Unknown'
}

function buildSummarySheet(workbook, doc, sheetName = 'Cover') {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
    properties: { defaultColWidth: 18 },
  })

  sheet.columns = [{ width: 24 }, { width: 54 }]

  const meta = doc.meta ?? {}
  const score = doc.copeScore ?? {}

  const brandRow = sheet.addRow(['AXIOM Property Intelligence'])
  sheet.mergeCells(brandRow.number, 1, brandRow.number, 2)
  brandRow.height = 30
  brandRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.black } }
  brandRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: THEME.white } }
  brandRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const accentRow = sheet.addRow(['Paid underwriting dossier'])
  sheet.mergeCells(accentRow.number, 1, accentRow.number, 2)
  accentRow.height = 18
  accentRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.orange } }
  accentRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.ink } }
  accentRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const titleRow = sheet.addRow([meta.title ?? 'COPE Underwriting Dossier'])
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 2)
  titleRow.height = 24
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.paper } }
  titleRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.ink } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  sheet.addRow([])

  const metadata = [
    ['Analysis ID#', meta.reportId ?? '-'],
    ['Location', meta.location ?? '-'],
    ['Generated', meta.generatedDate ?? '-'],
    ['Prepared by', meta.preparedBy ?? 'AXIOM Property Intelligence'],
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
    const isId = label.startsWith('Analysis ID')
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.orangeWash : THEME.labelFill },
    }
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.ink } }
    row.getCell(1).border = thinBorder()
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.orangeWash : THEME.white },
    }
    row.getCell(2).font = {
      name: isId ? 'Consolas' : 'Calibri',
      size: isId ? 11 : 10,
      bold: isId,
      color: { argb: isId ? 'FFB87A10' : THEME.ink },
    }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(2).border = thinBorder()
  }

  sheet.addRow([])

  const kpiHeader = sheet.addRow(['COPE completeness'])
  sheet.mergeCells(kpiHeader.number, 1, kpiHeader.number, 2)
  applySectionHeader(kpiHeader, THEME.orangeWash)
  kpiHeader.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.ink } }

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

  const footerRow = sheet.addRow([
    'Confidential. Generated by AXIOM Property Intelligence. Retain your Analysis ID# for retrieval.',
  ])
  sheet.mergeCells(footerRow.number, 1, footerRow.number, 2)
  footerRow.getCell(1).font = {
    name: 'Calibri',
    size: 9,
    italic: true,
    color: { argb: THEME.inkMuted },
  }
}

function buildCopeSheet(workbook, doc, sheetName = 'COPE Runway') {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })

  sheet.columns = COPE_COLUMNS.map(col => ({ key: col.key, width: col.width }))

  const headerRow = sheet.addRow(COPE_COLUMNS.map(col => col.header))
  applyHeaderRow(headerRow)

  let rowIndex = 0

  for (const section of doc.copeSections ?? []) {
    const sectionLabel = section.cope_letter
      ? `${section.cope_letter}  ${section.label ?? section.id ?? 'Section'}`
      : section.label ?? section.id ?? 'Section'

    const sectionRow = sheet.addRow([sectionLabel, '', '', '', ''])
    sheet.mergeCells(sectionRow.number, 1, sectionRow.number, COPE_COLUMNS.length)
    applySectionHeader(sectionRow, sectionAccent(section))

    const completeness = section.completeness ? `  ·  ${section.completeness}` : ''
    sectionRow.getCell(1).value = `${sectionLabel}${completeness}`
    sectionRow.getCell(1).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: THEME.ink },
    }

    for (const field of section.fields ?? []) {
      const dataRow = sheet.addRow([
        field.label ?? field.id ?? '',
        fieldDisplayValue(field),
        formatCopeSourceLabel(field.source) || '-',
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

function excelSheetName(label, index, suffix = '') {
  const base = slugifyLocation(label) || `loc-${index + 1}`
  const max = 31 - suffix.length
  return `${base.slice(0, max)}${suffix}`
}

function buildBatchOverviewSheet(workbook, batchRun) {
  const sheet = workbook.addWorksheet('Batch Cover', {
    views: [{ showGridLines: false }],
    properties: { defaultColWidth: 18 },
  })
  sheet.columns = [{ width: 22 }, { width: 48 }, { width: 16 }, { width: 16 }]

  const titleRow = sheet.addRow(['AXIOM Property Intelligence'])
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 4)
  titleRow.height = 28
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.black } }
  titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: THEME.white } }

  const accentRow = sheet.addRow(['Batch schedule export'])
  sheet.mergeCells(accentRow.number, 1, accentRow.number, 4)
  accentRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.orange } }
  accentRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.ink } }

  sheet.addRow([])
  const meta = [
    ['Analysis ID#', batchRun.batch_id ?? '-'],
    ['Total charged', batchRun.totals?.user_price_usd != null ? `$${batchRun.totals.user_price_usd.toFixed(2)}` : '-'],
    ['Locations quoted', String(batchRun.totals?.location_count ?? 0)],
    ['Completed', String((batchRun.locations ?? []).filter(loc => loc.record).length)],
  ]
  for (const [label, value] of meta) {
    const row = sheet.addRow([label, value])
    const isId = label.startsWith('Analysis ID')
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.ink } }
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.orangeWash : THEME.labelFill },
    }
    row.getCell(2).font = {
      name: isId ? 'Consolas' : 'Calibri',
      size: isId ? 11 : 10,
      bold: isId,
      color: { argb: isId ? 'FFB87A10' : THEME.ink },
    }
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.orangeWash : THEME.white },
    }
  }

  sheet.addRow([])
  const header = sheet.addRow(['#', 'Address', 'Status', 'Analysis ID#'])
  applyHeaderRow(header)

  ;(batchRun.locations ?? []).forEach((loc, index) => {
    const row = sheet.addRow([
      loc.row_index ?? index + 1,
      loc.display_name ?? loc.address_input ?? '-',
      loc.status ?? '-',
      loc.report_id ?? loc.record?.report_id ?? '-',
    ])
    const stripe = index % 2 === 1
    row.eachCell((cell, colNumber) => {
      applyBodyCell(cell, { stripe, center: colNumber === 1 || colNumber === 4, mono: colNumber === 4 })
    })
  })
}

/** Multi-location workbook: summary sheet plus COPE sheets per successful location. */
export async function downloadBatchCopeExcel(batchRun, { prefix = 'axiom-batch' } = {}) {
  if (!batchRun?.locations?.length) {
    throw new Error('No batch locations to export.')
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AXIOM Property Intelligence'
  workbook.created = new Date()
  workbook.modified = new Date()

  buildBatchOverviewSheet(workbook, batchRun)

  const enriched = batchRun.locations.filter(loc => loc.record)
  enriched.forEach((loc, index) => {
    const doc = buildCopeReportDocument(loc.record)
    const label = loc.display_name ?? loc.address_input ?? `Location ${index + 1}`
    const summaryName = excelSheetName(label, index, '-cover')
    const copeName = excelSheetName(label, index, '-cope')
    buildSummarySheet(workbook, doc, summaryName)
    buildCopeSheet(workbook, doc, copeName)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  if (!buffer?.byteLength) {
    throw new Error('Excel export returned an empty file.')
  }
  saveExcelBlob(buffer, batchRun.batch_id ?? 'batch', prefix)
}
