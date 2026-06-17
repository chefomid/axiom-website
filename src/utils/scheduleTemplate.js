import ExcelJS from 'exceljs'

const EXAMPLE_ROWS = [
  {
    address: '4504 Northeast Cleveland Avenue, Portland, OR 97211',
    locationId: 'LOC-001',
    notes: 'Main office',
  },
  {
    address: '456 Oak St, Portland, OR 97205',
    locationId: 'LOC-002',
    notes: '',
  },
]

export async function downloadScheduleTemplate() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AXIOM Property Intelligence'
  const sheet = workbook.addWorksheet('Schedule', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Address', key: 'address', width: 52 },
    { header: 'LocationId', key: 'locationId', width: 16 },
    { header: 'Notes', key: 'notes', width: 28 },
  ]

  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }
  header.alignment = { vertical: 'middle' }

  for (const row of EXAMPLE_ROWS) {
    sheet.addRow(row)
  }

  sheet.getCell('A1').note =
    'Required. Full US street address with city, state, and ZIP when possible.'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'property-schedule-template.xlsx'
  anchor.click()
  URL.revokeObjectURL(url)
}
