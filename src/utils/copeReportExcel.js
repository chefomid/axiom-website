import ExcelJS from 'exceljs'

import { buildCopeReportDocument, buildSovReportDocument } from './copeReportDocument'
import { formatCopeSourceLabel } from './copeSourceLabels'

/**
 * SovExcel master workbook palette.
 * Charcoal / paper / restrained amber accent / pine-teal brand green.
 */
const THEME = {
  black: 'FF1C1C1C',
  paper: 'FFFAFAF8',
  white: 'FFFFFFFF',
  ink: 'FF2C2C2C',
  inkMuted: 'FF6B6B6B',
  inkFaint: 'FF8A8A8A',
  border: 'FFD0D0CC',
  borderStrong: 'FFB4B4AE',
  orange: 'FFD4962A',
  orangeWash: 'FFFFF8EB',
  stripe: 'FFF7F7F5',
  labelFill: 'FFF1F1EE',
  sectionFill: 'FFF3F3F0',
  brandGreen: 'FF0F6B54',
  brandGreenWash: 'FFE8F4F0',
  confidenceHigh: 'FF1F7A4D',
  confidenceMedium: 'FFB45309',
  confidenceLow: 'FFCA8A04',
}

const SECTION_ACCENTS = {
  C: THEME.sectionFill,
  O: THEME.sectionFill,
  P: THEME.sectionFill,
  E: THEME.sectionFill,
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
  row.height = 24
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.black } }
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: THEME.white },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 0.5 }
    cell.border = thinBorder(THEME.black)
  })
}

function applyBodyCell(cell, { stripe = false, center = false, mono = false, muted = false } = {}) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: stripe ? THEME.stripe : THEME.white },
  }
  cell.font = {
    name: mono ? 'Consolas' : 'Calibri',
    size: 10,
    color: { argb: muted ? THEME.inkMuted : THEME.ink },
  }
  cell.alignment = {
    vertical: 'middle',
    horizontal: center ? 'center' : 'left',
    wrapText: true,
  }
  cell.border = thinBorder()
}

function applySectionHeader(row, accentArgb = THEME.sectionFill) {
  row.height = 22
  row.eachCell((cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentArgb } }
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: THEME.ink },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 }
    cell.border = thinBorder(THEME.borderStrong)
    if (colNumber === 1) {
      cell.border = {
        ...thinBorder(THEME.borderStrong),
        left: { style: 'medium', color: { argb: THEME.brandGreen } },
      }
    }
  })
}

function sectionAccent(section) {
  const letter = String(section?.cope_letter ?? section?.label ?? 'C')
    .trim()
    .charAt(0)
    .toUpperCase()
  return SECTION_ACCENTS[letter] ?? THEME.sectionFill
}

function cellDisplayText(cell) {
  const value = cell?.value
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text ?? '').join('')
    if (value.text != null) return String(value.text)
    if (value.result != null) return String(value.result)
  }
  return String(value)
}

/** Approximate Excel column widths and wrapped row heights so cell text stays visible. */
function autoFitSheet(
  sheet,
  { minWidth = 12, maxWidth = 56, minRowHeight = 18, maxRowHeight = 140 } = {},
) {
  const colWidths = {}

  sheet.eachRow(row => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellDisplayText(cell)
      const longestLine = text.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0)
      const estimate = Math.min(maxWidth, Math.max(minWidth, Math.ceil(longestLine * 1.05) + 2))
      colWidths[colNumber] = Math.max(colWidths[colNumber] ?? minWidth, estimate)
    })
  })

  Object.entries(colWidths).forEach(([col, width]) => {
    sheet.getColumn(Number(col)).width = width
  })

  sheet.eachRow(row => {
    let maxLines = 1
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellDisplayText(cell)
      const width = sheet.getColumn(colNumber).width || minWidth
      const charsPerLine = Math.max(8, width - 1)
      const lines = text.split(/\r?\n/).reduce((sum, line) => {
        return sum + Math.max(1, Math.ceil(line.length / charsPerLine))
      }, 0)
      maxLines = Math.max(maxLines, lines)
      cell.alignment = {
        ...(cell.alignment || {}),
        wrapText: true,
        vertical: 'middle',
      }
    })
    row.height = Math.min(maxRowHeight, Math.max(minRowHeight, 14 + maxLines * 13))
  })
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

  sheet.columns = [{ width: 26 }, { width: 56 }]

  const meta = doc.meta ?? {}
  const hasCope = Boolean(doc.copeSections?.length)
  const hasSov = Boolean(doc.statementOfValues && Object.keys(doc.statementOfValues).length)
  const contents = [
    hasCope ? 'COPE runway' : null,
    hasSov ? 'Statement of values' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const brandRow = sheet.addRow(['AXIOM Property Intelligence'])
  sheet.mergeCells(brandRow.number, 1, brandRow.number, 2)
  brandRow.height = 28
  brandRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.black } }
  brandRow.getCell(1).font = {
    name: 'Calibri',
    size: 13,
    bold: true,
    color: { argb: THEME.white },
  }
  brandRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const accentRow = sheet.addRow(['SovExcel master workbook'])
  sheet.mergeCells(accentRow.number, 1, accentRow.number, 2)
  accentRow.height = 18
  accentRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: THEME.brandGreen },
  }
  accentRow.getCell(1).font = {
    name: 'Calibri',
    size: 9,
    bold: true,
    color: { argb: THEME.white },
  }
  accentRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const titleRow = sheet.addRow([meta.location ?? meta.title ?? 'Property dossier'])
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 2)
  titleRow.height = 22
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.paper } }
  titleRow.getCell(1).font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: THEME.ink },
  }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  titleRow.getCell(1).border = thinBorder(THEME.borderStrong)

  sheet.addRow([])

  const metadata = [
    ['Analysis ID#', meta.reportId ?? '-'],
    ['Location', meta.location ?? '-'],
    ['Generated', meta.generatedDate ?? '-'],
    ['Prepared by', meta.preparedBy ?? 'AXIOM Property Intelligence'],
    ['Workbook contents', contents || '-'],
  ]
  if (meta.visionIsoClass || meta.visionIsoLabel) {
    metadata.push([
      'Image ISO estimate',
      [meta.visionIsoClass, meta.visionIsoLabel].filter(Boolean).join(', ') || '-',
    ])
  }

  for (const [label, value] of metadata) {
    const row = sheet.addRow([label, value])
    row.height = 19
    const isId = label.startsWith('Analysis ID')
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.labelFill },
    }
    row.getCell(1).font = {
      name: 'Calibri',
      size: 9,
      bold: true,
      color: { argb: THEME.inkMuted },
    }
    row.getCell(1).border = thinBorder()
    row.getCell(1).alignment = { vertical: 'middle', indent: 0.5 }
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.brandGreenWash : THEME.white },
    }
    row.getCell(2).font = {
      name: isId ? 'Consolas' : 'Calibri',
      size: isId ? 10 : 10,
      bold: isId,
      color: { argb: isId ? THEME.brandGreen : THEME.ink },
    }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' }
    row.getCell(2).border = thinBorder()
  }

  sheet.addRow([])

  const footerRow = sheet.addRow([
    'Confidential. Generated by AXIOM Property Intelligence. Retain your Analysis ID# for retrieval.',
  ])
  sheet.mergeCells(footerRow.number, 1, footerRow.number, 2)
  footerRow.getCell(1).font = {
    name: 'Calibri',
    size: 8,
    italic: true,
    color: { argb: THEME.inkFaint },
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
    const empty = sheet.addRow(['No SOV fields populated', '', ''])
    sheet.mergeCells(empty.number, 1, empty.number, SOV_COLUMNS.length)
    applyBodyCell(empty.getCell(1))
    autoFitSheet(sheet)
    return
  }

  entries.forEach(([fieldId, entry], index) => {
    const row = sheet.addRow([
      sovFieldLabel(fieldId),
      entry?.value != null && entry.value !== '' ? String(entry.value) : '-',
      formatCopeSourceLabel(entry?.primary_source) || entry?.primary_source || '-',
    ])
    const stripe = index % 2 === 1
    applyBodyCell(row.getCell(1), { stripe, muted: true })
    applyBodyCell(row.getCell(2), { stripe, mono: true })
    applyBodyCell(row.getCell(3), { stripe })
  })

  const discrepancies = doc.sovAnalysis?.discrepancies || []
  if (discrepancies.length) {
    sheet.addRow([])
    const section = sheet.addRow(['Lane discrepancies', '', ''])
    sheet.mergeCells(section.number, 1, section.number, SOV_COLUMNS.length)
    applySectionHeader(section, THEME.brandGreenWash)

    const discHeader = sheet.addRow(['Field', 'Status', 'Resolved value'])
    applyHeaderRow(discHeader)

    discrepancies.forEach((item, index) => {
      const row = sheet.addRow([
        sovFieldLabel(item.field_id),
        item.status || '-',
        item.resolved_value != null ? String(item.resolved_value) : '-',
      ])
      const stripe = index % 2 === 1
      row.eachCell((cell, colNumber) => {
        applyBodyCell(cell, { stripe, center: colNumber === 2 })
      })
    })
  }

  const enrichments = doc.sovAnalysis?.enrichments || []
  if (enrichments.length) {
    sheet.addRow([])
    const section = sheet.addRow(['Gap fills', '', ''])
    sheet.mergeCells(section.number, 1, section.number, SOV_COLUMNS.length)
    applySectionHeader(section, THEME.brandGreenWash)

    const enrichHeader = sheet.addRow(['Field', 'Value', 'Source'])
    applyHeaderRow(enrichHeader)

    enrichments.forEach((item, index) => {
      const row = sheet.addRow([
        sovFieldLabel(item.field_id),
        item.value != null ? String(item.value) : '-',
        formatCopeSourceLabel(item.source) || item.source || '-',
      ])
      const stripe = index % 2 === 1
      row.eachCell((cell, colNumber) => {
        applyBodyCell(cell, { stripe, mono: colNumber === 2 })
      })
    })
  }

  autoFitSheet(sheet)
}

function buildCopeSheet(workbook, doc, sheetName = 'COPE') {
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
    sectionRow.getCell(1).value = sectionLabel

    for (const field of section.fields ?? []) {
      const dataRow = sheet.addRow([
        field.label ?? field.id ?? '',
        fieldDisplayValue(field),
        fieldSourceValue(field),
      ])
      dataRow.height = 18
      const stripe = rowIndex % 2 === 1
      const missing = !isFieldPopulated(field)
      applyBodyCell(dataRow.getCell(1), { stripe, muted: true })
      applyBodyCell(dataRow.getCell(2), { stripe, mono: true, muted: missing })
      applyBodyCell(dataRow.getCell(3), { stripe, muted: missing })
      rowIndex += 1
    }

    sheet.addRow([])
  }

  autoFitSheet(sheet)
}

/** Master SovExcel workbook: Cover + COPE (when present) + Statement of Values (when present). */
export async function buildSovExcelWorkbook(doc) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = doc.meta?.preparedBy ?? 'AXIOM Property Intelligence'
  workbook.created = new Date()
  workbook.modified = new Date()

  const masterDoc = {
    ...doc,
    meta: {
      ...(doc.meta ?? {}),
      title: doc.meta?.location ?? 'SovExcel dossier',
    },
  }

  buildSummarySheet(workbook, masterDoc, 'Cover')
  if (masterDoc.copeSections?.length) {
    buildCopeSheet(workbook, masterDoc, 'COPE')
  }
  if (masterDoc.statementOfValues && Object.keys(masterDoc.statementOfValues).length) {
    buildSovSheet(workbook, masterDoc, 'Statement of Values')
  }

  return workbook
}

/** @deprecated Prefer buildSovExcelWorkbook; kept for batch/exit-modal callers. */
export async function buildCopeExcelWorkbook(doc) {
  return buildSovExcelWorkbook(doc)
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

/** Download master SovExcel workbook (Cover + COPE + SOV sheets as available). */
export async function downloadSovExcel(doc, locationLabel, { prefix = 'sovexcel' } = {}) {
  const hasCope = Boolean(doc?.copeSections?.length)
  const hasSov = Boolean(doc?.statementOfValues && Object.keys(doc.statementOfValues).length)
  if (!hasCope && !hasSov) {
    throw new Error('No COPE or Statement of Values data available to export.')
  }
  const workbook = await buildSovExcelWorkbook(doc)
  const buffer = await workbook.xlsx.writeBuffer()
  if (!buffer?.byteLength) {
    throw new Error('Excel export returned an empty file.')
  }
  saveExcelBlob(buffer, locationLabel, prefix)
}

/** @deprecated Prefer downloadSovExcel; kept for exit-modal / batch callers. */
export async function downloadCopeExcel(doc, locationLabel, { prefix = 'sovexcel' } = {}) {
  await downloadSovExcel(doc, locationLabel, { prefix })
}

/** Convenience: build document from enrich record, then download. */
export async function downloadCopeExcelFromRecord(record, locationLabel, { prefix = 'sovexcel' } = {}) {
  const doc = record?.cope?.sections?.length
    ? buildCopeReportDocument(record)
    : buildSovReportDocument(record)
  await downloadSovExcel(doc, locationLabel, { prefix })
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

  const accentRow = sheet.addRow(['SovExcel batch export'])
  sheet.mergeCells(accentRow.number, 1, accentRow.number, 4)
  accentRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: THEME.brandGreen },
  }
  accentRow.getCell(1).font = {
    name: 'Calibri',
    size: 9,
    bold: true,
    color: { argb: THEME.white },
  }

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
    row.getCell(1).font = {
      name: 'Calibri',
      size: 9,
      bold: true,
      color: { argb: THEME.inkMuted },
    }
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: THEME.labelFill },
    }
    row.getCell(1).border = thinBorder()
    row.getCell(2).font = {
      name: isId ? 'Consolas' : 'Calibri',
      size: 10,
      bold: isId,
      color: { argb: isId ? THEME.brandGreen : THEME.ink },
    }
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isId ? THEME.brandGreenWash : THEME.white },
    }
    row.getCell(2).border = thinBorder()
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
