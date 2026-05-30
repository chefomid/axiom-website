export default function DataTable({ table }) {
  if (!table?.rows?.length) return null

  return (
    <div className="report-print-section">
      <div className="report-print-table-caption">{table.title}</div>
      {table.unit ? <div className="report-print-table-unit">Unit: {table.unit}</div> : null}
      <table className="report-print-table">
        <thead>
          <tr>
            {(table.columns ?? ['Band', 'Value']).map(col => (
              <th key={col} style={col !== table.columns?.[0] ? { textAlign: 'right' } : undefined}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(row => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
