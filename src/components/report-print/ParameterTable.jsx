export default function ParameterTable({ rows }) {
  if (!rows?.length) return null

  return (
    <table className="report-print-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th style={{ textAlign: 'right' }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
