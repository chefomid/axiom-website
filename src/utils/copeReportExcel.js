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
  { key: 'value', header: 'Value', width: 42 },
  { key: 'source', header: 'Source', width: 24 },
]

const DATA_NOT_AVAILABLE = 'Data not available'

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

function isFieldPopulated(field) {
  const status = String(field?.status ?? '').toLowerCase()
  if (status === 'unknown') return false
  return field?.value != null && String(field.value).trim() !== ''
}

function fieldDisplayValue(field) {
  if (!isFieldPopulated(field)) return DATA_NOT_AVAILABLE
  return String(field.value)
}

function fieldSourceValue(field) {
  if (!isFieldPopulated(field)) return DATA_NOT_AVAILABLE
  return formatCopeSourceLabel(field.source) || field.source || DATA_NOT_AVAILABLE
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

  const accentLabel =
    meta.type === 'sov' ? 'Statement of values export' : 'Paid underwriting dossier'
  const accentRow = sheet.addRow([accentLabel])
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

  if (meta.type !== 'sov') {
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
  } else {
    const sovCount = Object.keys(doc.statementOfValues || {}).length
    sheet.addRow([])
    const kpiHeader = sheet.addRow(['SOV schedule'])
    sheet.mergeCells(kpiHeader.number, 1, kpiHeader.number, 2)
    applySectionHeader(kpiHeader, THEME.orangeWash)
    const row = sheet.addRow(['Reconciled fields', String(sovCount)])
    row.height = 20
    applyBodyCell(row.getCell(1))
    applyBodyCell(row.getCell(2), { center: true })
    row.getCell(1).font = { ...row.getCell(1).font, bold: true }
  }

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

const SOV_FIELD_LABELS = {
  year_built: 'Year built',
  square_footage: 'Building sq ft',
  stories: 'Number of stories',
  construction_type: 'Construction type',
  iso_construction_class: 'ISO construction class',
  roof_type: 'Roof type',
  property_type: 'Property type',
  parcel_number: 'Parcel / APN',
  owner_name: 'Owner of record',
  zoning: 'Zoning / land use',
  occupancy_use: 'Occupancy / use code',
  assessed_value: 'Assessed value',
}

const SOV_FIELD_ORDER = Object.keys(SOV_FIELD_LABELS)

const SOV_COLUMNS = [
  { key: 'field', header: 'Field', width: 28 },
  { key: 'value', header: 'Value', width: 34 },
  { key: 'source', header: 'Primary source', width: 24 },
  { key: 'confidence', header: 'Confidence', width: 14 },
  { key: 'lanes', header: 'Supporting lanes', width: 28 },
]

function sovFieldLabel(fieldId) {
  return SOV_FIELD_LABELS[fieldId] || String(fieldId ?? '').replace(/_/g, ' ')
}

function orderedSovEntries(statementOfValues) {
  const entries = Object.entries(statementOfValues || {})
  const order = new Map(SOV_FIELD_ORDER.map((id, index) => [id, index]))
  return entries.sort(([a], [b]) => {
    const ai = order.has(a) ? order.get(a) : 999
    const bi = order.has(b) ? order.get(b) : 999
    if (ai !== bi) return ai - bi
    return a.localeCompare(b)
  })
}

function buildSovSheet(workbook, doc, sheetName = 'Statement of Values') {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })

  sheet.columns = SOV_COLUMNS.map(col => ({ key: col.key, width: col.width }))

  const headerRow = sheet.addRow(SOV_COLUMNS.map(col => col.header))
  applyHeaderRow(headerRow)

  const entries = orderedSovEntries(doc.statementOfValues)
  if (!entries.length) {
    const empty = sheet.addRow(['No SOV fields populated', '', '', '', ''])
    sheet.mergeCells(empty.number, 1, empty.number, SOV_COLUMNS.length)
    applyBodyCell(empty.getCell(1))
    return
  }

  entries.forEach(([fieldId, entry], index) => {
    const lanes = Array.isArray(entry?.supporting_lanes) ? entry.supporting_lanes.join(', ') : '-'
    const row = sheet.addRow([
      sovFieldLabel(fieldId),
      entry?.value != null && entry.value !== '' ? String(entry.value) : '-',
      formatCopeSourceLabel(entry?.primary_source) || entry?.primary_source || '-',
      entry?.confidence || '-',
      lanes || '-',
    ])
    row.height = 20
    const stripe = index % 2 === 1
    applyBodyCell(row.getCell(1), { stripe })
    applyBodyCell(row.getCell(2), { stripe, mono: true })
    applyBodyCell(row.getCell(3), { stripe })
    applyBodyCell(row.getCell(4), { stripe, center: true })
    applyBodyCell(row.getCell(5), { stripe })
  })

  const discrepancies = doc.sovAnalysis?.discrepancies || []
  if (discrepancies.length) {
    sheet.addRow([])
    const section = sheet.addRow(['Lane discrepancies', '', '', '', ''])
    sheet.mergeCells(section.number, 1, section.number, SOV_COLUMNS.length)
    applySectionHeader(section, THEME.orangeWash)

    const discHeader = sheet.addRow(['Field', 'Status', 'Resolved value', 'Rationale', 'Lane values'])
    applyHeaderRow(discHeader)

    discrepancies.forEach((item, index) => {
      const laneText = Object.entries(item.lane_values || {})
        .filter(([, value]) => value != null && value !== '')
        .map(([lane, value]) => `${lane}: ${value}`)
        .join(' | ')
      const row = sheet.addRow([
        sovFieldLabel(item.field_id),
        item.status || '-',
        item.resolved_value != null ? String(item.resolved_value) : '-',
        item.rationale || '-',
        laneText || '-',
      ])
      const stripe = index % 2 === 1
      row.eachCell((cell, colNumber) => {
        applyBodyCell(cell, { stripe, center: colNumber === 2 })
      })
      row.height = 28
    })
  }

  const enrichments = doc.sovAnalysis?.enrichments || []
  if (enrichments.length) {
    sheet.addRow([])
    const section = sheet.addRow(['Gap fills', '', '', '', ''])
    sheet.mergeCells(section.number, 1, section.number, SOV_COLUMNS.length)
    applySectionHeader(section, THEME.orangeWash)

    const enrichHeader = sheet.addRow(['Field', 'Value', 'Source', 'Note', ''])
    applyHeaderRow(enrichHeader)

    enrichments.forEach((item, index) => {
      const row = sheet.addRow([
        sovFieldLabel(item.field_id),
        item.value != null ? String(item.value) : '-',
        formatCopeSourceLabel(item.source) || item.source || '-',
        item.note || '-',
        '',
      ])
      const stripe = index % 2 === 1
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 4) applyBodyCell(cell, { stripe, mono: colNumber === 2 })
      })
    })
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

    const sectionRow = sheet.addRow([sectionLabel, '', ''])
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
        fieldSourceValue(field),
      ])
      dataRow.height = 18
      const stripe = rowIndex % 2 === 1
      applyBodyCell(dataRow.getCell(1), { stripe })
      applyBodyCell(dataRow.getCell(2), { stripe, mono: true })
      applyBodyCell(dataRow.getCell(3), { stripe })
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
  if (doc.statementOfValues && Object.keys(doc.statementOfValues).length) {
    buildSovSheet(workbook, doc)
  }

  return workbook
}

export async function buildSovExcelWorkbook(doc) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = doc.meta?.preparedBy ?? 'AXIOM Property Intelligence'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sovDoc = {
    ...doc,
    meta: {
      ...(doc.meta ?? {}),
      title: 'Statement of Values',
    },
  }
  buildSummarySheet(workbook, sovDoc, 'Cover')
  buildSovSheet(workbook, sovDoc)
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

/** Dedicated SOV workbook: cover + statement of values schedule. */
export async function downloadSovExcel(doc, locationLabel, { prefix = 'sov-report' } = {}) {
  if (!doc?.statementOfValues || !Object.keys(doc.statementOfValues).length) {
    throw new Error('Statement of Values is required to export SOV Excel.')
  }
  const workbook = await buildSovExcelWorkbook(doc)
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
