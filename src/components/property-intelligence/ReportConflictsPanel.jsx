function formatFieldId(fieldId) {
  return String(fieldId ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function ReportConflictsPanel({ conflicts, cope }) {
  const items = (conflicts ?? []).filter(c => c.alternatives?.length > 1)

  if (!items.length) {
    return (
      <p className="p-4 font-mono text-[10px] text-ink-faint">
        No source conflicts detected. Vendors agree on all mapped COPE fields for this address.
      </p>
    )
  }

  const resolvedByField = {}
  for (const section of cope?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.id) resolvedByField[field.id] = field
    }
  }

  return (
    <div className="space-y-0 p-4">
      <p className="mb-3 font-mono text-[9px] leading-relaxed text-ink-faint">
        Competing values from different sources. SOV orchestrator rationale appears when multi-lane reconciliation ran.
      </p>
      <ul className="space-y-3">
        {items.map(conflict => {
          const resolved = resolvedByField[conflict.field_id]
          return (
            <li
              key={conflict.field_id}
              className="rounded border border-command-watch/30 bg-command-watch/5 px-3 py-2"
            >
              <p className="font-mono text-[10px] font-medium text-white">
                {formatFieldId(conflict.field_id)}
              </p>
              {resolved?.value ? (
                <p className="mt-1 font-mono text-[9px] text-command-stable">
                  Resolved: {resolved.value}
                  {resolved.source ? ` (${resolved.source})` : ''}
                </p>
              ) : null}
              {conflict.rationale ? (
                <p className="mt-1 font-mono text-[9px] text-command-watch">{conflict.rationale}</p>
              ) : null}
              <ul className="mt-2 space-y-1">
                {conflict.alternatives.map((alt, i) => (
                  <li key={i} className="font-mono text-[9px] text-ink-secondary">
                    {alt.value}{' '}
                    <span className="text-ink-faint">, {alt.source}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
