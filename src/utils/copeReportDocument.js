import { formatReportDate } from './earthquakeReport'
import { PREPARED_BY } from './reportDocument'

export function buildCopeReportDocument(record) {
  if (!record?.cope?.sections?.length) {
    throw new Error('COPE snapshot is required to export a dossier PDF.')
  }

  const location = record.display_name || record.address_input || 'Property location'
  const hazardsSummary = Object.entries(record.hazards ?? {})
    .filter(([, data]) => data?.summary)
    .map(([key, data]) => ({ source: key, summary: data.summary }))

  return {
    meta: {
      type: 'cope',
      title: 'COPE Underwriting Dossier',
      location,
      generatedDate: formatReportDate(new Date()),
      preparedBy: PREPARED_BY,
      reportId: record.report_id ?? null,
      dataSource: 'AXIOM Property Intelligence',
      visionDisclaimer: record.vision_analysis?.disclaimer ?? null,
      visionIsoClass: record.vision_analysis?.iso_class ?? null,
      visionIsoLabel: record.vision_analysis?.iso_label ?? null,
    },
    copeSections: record.cope.sections,
    copeScore: record.cope.score ?? {},
    conflicts: (record.conflicts ?? []).filter(c => c.alternatives?.length > 1),
    receipt: record.receipt ?? null,
    hazardsSummary,
    selectedSources: record.selected_sources ?? [],
    visionAnalysis: record.vision_analysis ?? null,
    inspectionDigestMd: record.vision_analysis?.inspection_digest_md ?? null,
    statementOfValues: record.statement_of_values ?? null,
    sovDigestMd: record.sov_digest_md ?? null,
    sovAnalysis: record.sov_analysis ?? null,
  }
}

export function validateCopeReportDocument(doc) {
  const errors = []
  if (!doc?.meta?.type || doc.meta.type !== 'cope') errors.push('Invalid COPE report document type.')
  if (!doc?.meta?.location) errors.push('Location is missing.')
  if (!doc?.copeSections?.length) errors.push('COPE sections are missing.')
  return errors
}
