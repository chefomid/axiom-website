import ExcelJS from 'exceljs'

export const SCHEDULE_MAX_LOCATIONS = 100

export const SCHEDULE_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

const REJECTED_EXTENSIONS = ['.xlsm', '.xlsb']

export function getScheduleFileExtension(filename) {
  const name = String(filename ?? '').toLowerCase()
  for (const ext of REJECTED_EXTENSIONS) {
    if (name.endsWith(ext)) return ext
  }
  for (const ext of SCHEDULE_ACCEPTED_EXTENSIONS) {
    if (name.endsWith(ext)) return ext
  }
  return null
}

export function isAcceptedScheduleFile(file) {
  const ext = getScheduleFileExtension(file?.name)
  return ext != null && SCHEDULE_ACCEPTED_EXTENSIONS.includes(ext)
}

export function scheduleFileTypeError(filename) {
  const ext = getScheduleFileExtension(filename)
  if (ext && REJECTED_EXTENSIONS.includes(ext)) {
    return 'Macro-enabled Excel files (.xlsm) are not supported. Save as .xlsx or use .csv.'
  }
  return 'Upload a .xlsx, .xls, or .csv file.'
}

const ADDRESS_HEADERS = new Set(['address', 'street address', 'street', 'property address', 'location'])
const ID_HEADERS = new Set(['locationid', 'location id', 'id', 'property id', 'site id'])
const NOTES_HEADERS = new Set(['notes', 'note', 'comments', 'comment'])

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function splitAddressText(text) {
  return String(text ?? '')
    .split(/[\n,;]+/)
    .map(part => part.trim())
    .filter(Boolean)
}

function dedupeRows(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const key = row.address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function parseSchedulePaste(text) {
  const rows = splitAddressText(text).map((address, index) => ({
    rowIndex: index + 1,
    address,
    locationId: '',
    notes: '',
  }))
  return dedupeRows(rows).slice(0, SCHEDULE_MAX_LOCATIONS)
}

function mapHeaders(headerRow) {
  const mapping = { address: -1, locationId: -1, notes: -1 }
  headerRow.eachCell((cell, colNumber) => {
    const h = normalizeHeader(cell.value)
    if (ADDRESS_HEADERS.has(h)) mapping.address = colNumber
    else if (ID_HEADERS.has(h)) mapping.locationId = colNumber
    else if (NOTES_HEADERS.has(h)) mapping.notes = colNumber
  })
  if (mapping.address < 0) {
    mapping.address = 1
  }
  return mapping
}

function cellText(cell) {
  if (cell == null || cell.value == null) return ''
  if (typeof cell.value === 'object' && cell.value.text) return String(cell.value.text).trim()
  return String(cell.value).trim()
}

export async function parseScheduleFile(file) {
  const name = file.name.toLowerCase()
  const ext = getScheduleFileExtension(name)

  if (!ext || !SCHEDULE_ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new Error(scheduleFileTypeError(name))
  }

  if (ext === '.csv') {
    const text = await file.text()
    return parseSchedulePaste(text)
  }

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Spreadsheet has no worksheets.')

  const headerRow = sheet.getRow(1)
  const cols = mapHeaders(headerRow)
  const rows = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const address = cellText(row.getCell(cols.address))
    if (!address) return
    rows.push({
      rowIndex: rowNumber - 1,
      address,
      locationId: cols.locationId > 0 ? cellText(row.getCell(cols.locationId)) : '',
      notes: cols.notes > 0 ? cellText(row.getCell(cols.notes)) : '',
    })
  })

  return dedupeRows(rows).slice(0, SCHEDULE_MAX_LOCATIONS)
}
