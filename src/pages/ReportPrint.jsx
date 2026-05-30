import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import ReportPrintDocument from '../components/report-print/ReportPrintDocument'
import { fetchReportSession } from '../services/reportApi'
import '../styles/report-print.css'

export default function ReportPrint() {
  const { sessionId } = useParams()
  const [document, setDocument] = useState(() => window.__AXIOM_REPORT_DOC__ ?? null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) {
      setError('Missing report session ID.')
      return
    }

    const injected = window.__AXIOM_REPORT_DOC__
    if (injected) {
      setDocument(injected)
      return
    }

    let cancelled = false
    fetchReportSession(sessionId)
      .then(doc => {
        if (!cancelled) setDocument(doc)
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Failed to load report session.')
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (error) {
    return (
      <div id="report-print-error" className="report-print-error">
        {error}
      </div>
    )
  }

  if (!document) {
    return <div className="report-print-loading">Loading report…</div>
  }

  return <ReportPrintDocument document={document} />
}
