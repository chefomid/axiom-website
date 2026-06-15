import { useEffect, useState } from 'react'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import { GhostButton, PrimaryButton } from '../components/ui/CommandControls'
import {
  SUBMISSION_STATUSES,
  clearAdminToken,
  downloadCsv,
  fetchSubmission,
  fetchSubmissions,
  getResumeAuthHeaders,
  hasAdminToken,
  loginAdmin,
  resumeDownloadUrl,
  updateSubmission,
} from '../services/careersAdminApi'

function formatDate(value) {
  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function StatusBadge({ status }) {
  const label = SUBMISSION_STATUSES.find(item => item.value === status)?.label ?? status
  const tone =
    status === 'new'
      ? 'text-command-stable border-command-stable/40 bg-command-stable/10'
      : status === 'reviewing'
        ? 'text-command-live border-command-live/40 bg-command-live/10'
        : status === 'contacted'
          ? 'text-command-cyber border-command-cyber/40 bg-command-cyber/10'
          : 'text-ink-muted border-panel-border bg-panel-surface/40'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}
    >
      {label}
    </span>
  )
}

function groupApplicants(submissions) {
  const map = new Map()
  for (const item of submissions) {
    const key = String(item.applicantEmail ?? '')
      .trim()
      .toLowerCase()
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        email: item.applicantEmail,
        name: item.applicantName,
        phone: item.applicantPhone ?? '',
        location: item.applicantLocation ?? '',
        submissions: [item],
      })
      continue
    }
    existing.submissions.push(item)
  }

  return [...map.values()]
    .map(profile => {
      const sorted = [...profile.submissions].sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      )
      const latest = sorted[0]
      return {
        email: latest.applicantEmail,
        name: latest.applicantName,
        phone: latest.applicantPhone ?? '',
        location: latest.applicantLocation ?? '',
        submissions: sorted,
      }
    })
    .sort((a, b) => new Date(b.submissions[0].submittedAt) - new Date(a.submissions[0].submittedAt))
}

function LoginGate({ onAuthenticated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedUser = username.trim()
    if (!trimmedUser || !password) return

    setLoading(true)
    setError(null)
    try {
      await loginAdmin(trimmedUser, password)
      await fetchSubmissions()
      onAuthenticated()
    } catch (err) {
      clearAdminToken()
      setError(err?.message ?? 'Access denied.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-panel-border bg-panel-bg/80 p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        Careers admin
      </p>
      <h1 className="mt-3 font-display text-2xl font-medium tracking-tight text-white">Sign in</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
        This area is restricted to the AXIOM team.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Username
          </span>
          <input
            type="text"
            value={username}
            onChange={event => setUsername(event.target.value)}
            autoComplete="username"
            className="mt-2 w-full rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-2 w-full rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25"
          />
        </label>
        {error ? (
          <p className="text-xs text-command-critical" role="alert">
            {error}
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>
      </form>
    </div>
  )
}

function SubmissionDetail({ submission, onUpdated, onUnauthorized }) {
  const [status, setStatus] = useState(submission.status)
  const [notes, setNotes] = useState(submission.adminNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setStatus(submission.status)
    setNotes(submission.adminNotes ?? '')
  }, [submission])

  async function savePatch(patch) {
    setSaving(true)
    setMessage(null)
    try {
      const data = await updateSubmission(submission.referenceId, patch)
      onUpdated(data.submission)
      setMessage('Saved.')
    } catch (err) {
      if (err?.status === 401) onUnauthorized()
      setMessage(err?.message ?? 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(event) {
    const next = event.target.value
    setStatus(next)
    await savePatch({ status: next })
  }

  async function handleNotesBlur() {
    if (notes === (submission.adminNotes ?? '')) return
    await savePatch({ adminNotes: notes })
  }

  async function handleResumeDownload() {
    try {
      const response = await fetch(resumeDownloadUrl(submission.referenceId), {
        headers: getResumeAuthHeaders(),
      })
      if (!response.ok) throw new Error('Resume download failed.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${submission.referenceId}-resume`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setMessage(err?.message ?? 'Could not download resume.')
    }
  }

  const sections = submission.payload?.sections ?? []

  return (
    <div className="rounded-2xl border border-panel-border bg-panel-bg/80 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            {submission.referenceId}
          </p>
          <h2 className="mt-2 font-display text-xl font-medium text-white">
            {submission.applicantName}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">{submission.applicantEmail}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {submission.applicantPhone || 'No phone'} · {submission.applicantLocation || 'No location'}{' '}
            · {formatDate(submission.submittedAt)}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Status
          </span>
          <select
            value={status}
            onChange={handleStatusChange}
            disabled={saving}
            className="mt-2 w-full rounded-lg border border-panel-border bg-panel-surface/60 px-3 py-2.5 text-sm text-ink-primary focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25"
          >
            {SUBMISSION_STATUSES.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <a
            href={`mailto:${submission.applicantEmail}`}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
          >
            Email applicant
          </a>
          {submission.hasResume ? (
            <button
              type="button"
              onClick={handleResumeDownload}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
            >
              Download resume
            </button>
          ) : null}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          Internal notes
        </span>
        <textarea
          value={notes}
          onChange={event => setNotes(event.target.value)}
          onBlur={handleNotesBlur}
          rows={4}
          placeholder="Team-only notes…"
          className="mt-2 w-full rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-3 text-sm leading-relaxed text-ink-primary placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25"
        />
      </label>

      {message ? <p className="mt-2 text-xs text-ink-muted">{message}</p> : null}

      <div className="mt-8 space-y-6">
        {sections.map(section => (
          <section key={section.title}>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {section.title}
            </h3>
            <div className="mt-3 space-y-4 rounded-xl border border-panel-border bg-panel-surface/30 p-4">
              {section.items.map(item => (
                <div key={item.label}>
                  <p className="text-[13px] font-medium text-ink-primary">{item.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function PersonProfilePanel({
  profile,
  selectedRef,
  onSelectApplication,
  selectedDetail,
  onUpdated,
  onUnauthorized,
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-panel-border bg-panel-bg/80 p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          Applicant profile
        </p>
        <h2 className="mt-2 font-display text-xl font-medium text-white">{profile.name}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{profile.email}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {profile.phone || 'No phone'} · {profile.location || 'No location'}
        </p>
        <a
          href={`mailto:${profile.email}`}
          className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
        >
          Email applicant
        </a>

        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Applications ({profile.submissions.length})
          </p>
          <ul className="mt-3 divide-y divide-panel-border rounded-xl border border-panel-border bg-panel-surface/30">
            {profile.submissions.map(item => (
              <li key={item.referenceId}>
                <button
                  type="button"
                  onClick={() => onSelectApplication(item.referenceId)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                    selectedRef === item.referenceId ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <div>
                    <p className="font-mono text-[10px] text-ink-faint">{item.referenceId}</p>
                    <p className="mt-1 text-xs text-ink-muted">{formatDate(item.submittedAt)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {selectedDetail ? (
        <SubmissionDetail
          submission={selectedDetail}
          onUpdated={onUpdated}
          onUnauthorized={onUnauthorized}
        />
      ) : null}
    </div>
  )
}

export default function CareersAdmin() {
  const [authenticated, setAuthenticated] = useState(hasAdminToken())
  const [submissions, setSubmissions] = useState([])
  const [selectedRef, setSelectedRef] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [viewMode, setViewMode] = useState('applications')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const applicants = groupApplicants(submissions)
  const selectedProfile = applicants.find(
    profile => profile.email.toLowerCase() === selectedEmail?.toLowerCase(),
  )

  useEffect(() => {
    document.title = 'Careers Admin | AXIOM'
    const meta = document.querySelector('meta[name="robots"]')
    const previous = meta?.getAttribute('content') ?? null
    if (meta) meta.setAttribute('content', 'noindex, nofollow')
    return () => {
      document.title = 'AXIOM'
      if (meta && previous) meta.setAttribute('content', previous)
    }
  }, [])

  async function loadList() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSubmissions({ status: statusFilter, q: search })
      setSubmissions(data.submissions ?? [])
    } catch (err) {
      if (err?.status === 401) {
        clearAdminToken()
        setAuthenticated(false)
      }
      setError(err?.message ?? 'Could not load submissions.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(referenceId) {
    setSelectedRef(referenceId)
    setSelectedDetail(null)
    try {
      const data = await fetchSubmission(referenceId)
      setSelectedDetail(data.submission)
    } catch (err) {
      if (err?.status === 401) {
        clearAdminToken()
        setAuthenticated(false)
        return
      }
      setError(err?.message ?? 'Could not load submission.')
    }
  }

  useEffect(() => {
    if (!authenticated) return
    loadList()
  }, [authenticated, statusFilter])

  function handleUnauthorized() {
    clearAdminToken()
    setAuthenticated(false)
  }

  async function handleExport() {
    try {
      await downloadCsv({ status: statusFilter, q: search })
    } catch (err) {
      if (err?.status === 401) handleUnauthorized()
      setError(err?.message ?? 'Export failed.')
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black font-sans text-ink-primary">
        <Nav />
        <main className="px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
          <LoginGate onAuthenticated={() => setAuthenticated(true)} />
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black font-sans text-ink-primary">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Internal
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-white">
              Careers Admin
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <GhostButton
              onClick={() => {
                clearAdminToken()
                setAuthenticated(false)
              }}
            >
              Sign out
            </GhostButton>
            <button
              type="button"
              onClick={handleExport}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
            >
              Export CSV
            </button>
          </div>
        </header>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode('applications')
              setSelectedEmail(null)
            }}
            className={`rounded-lg border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              viewMode === 'applications'
                ? 'border-command-live/50 bg-command-live/10 text-white'
                : 'border-panel-border bg-panel-surface/60 text-ink-secondary hover:text-white'
            }`}
          >
            Applications
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('people')
              setSelectedRef(null)
              setSelectedDetail(null)
            }}
            className={`rounded-lg border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
              viewMode === 'people'
                ? 'border-command-live/50 bg-command-live/10 text-white'
                : 'border-panel-border bg-panel-surface/60 text-ink-secondary hover:text-white'
            }`}
          >
            People
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="rounded-lg border border-panel-border bg-panel-surface/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary focus:border-command-live/50 focus:outline-none"
          >
            <option value="">All statuses</option>
            {SUBMISSION_STATUSES.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') loadList()
            }}
            placeholder="Search name, email, reference…"
            className="min-w-[16rem] flex-1 rounded-lg border border-panel-border bg-panel-surface/60 px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-faint focus:border-command-live/50 focus:outline-none focus:ring-1 focus:ring-command-live/25"
          />
          <button
            type="button"
            onClick={loadList}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-command-stable transition-colors hover:text-command-cyber"
          >
            Search
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-command-critical" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          {viewMode === 'applications' ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-panel-border bg-panel-bg/80">
                <div className="border-b border-panel-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  Inbox {loading ? '· loading…' : `· ${submissions.length}`}
                </div>
                <ul className="divide-y divide-panel-border">
                  {submissions.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-ink-muted">No submissions yet.</li>
                  ) : (
                    submissions.map(item => (
                      <li key={item.referenceId}>
                        <button
                          type="button"
                          onClick={() => loadDetail(item.referenceId)}
                          className={`flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] ${
                            selectedRef === item.referenceId ? 'bg-white/[0.04]' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[10px] text-ink-faint">
                              {item.referenceId}
                            </p>
                            <p className="mt-1 truncate text-sm text-white">{item.applicantName}</p>
                            <p className="truncate text-xs text-ink-muted">{item.applicantEmail}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusBadge status={item.status} />
                            <p className="mt-2 font-mono text-[10px] text-ink-faint">
                              {formatDate(item.submittedAt)}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                {selectedDetail ? (
                  <SubmissionDetail
                    submission={selectedDetail}
                    onUpdated={updated => {
                      setSelectedDetail(updated)
                      setSubmissions(prev =>
                        prev.map(item =>
                          item.referenceId === updated.referenceId
                            ? { ...item, status: updated.status, adminNotes: updated.adminNotes }
                            : item,
                        ),
                      )
                    }}
                    onUnauthorized={handleUnauthorized}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-panel-border bg-panel-surface/20 p-10 text-center text-sm text-ink-muted">
                    Select a submission to review the full response record.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-panel-border bg-panel-bg/80">
                <div className="border-b border-panel-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  People {loading ? '· loading…' : `· ${applicants.length}`}
                </div>
                <ul className="divide-y divide-panel-border">
                  {applicants.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-ink-muted">No applicants yet.</li>
                  ) : (
                    applicants.map(profile => (
                      <li key={profile.email}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmail(profile.email)
                            setSelectedRef(null)
                            setSelectedDetail(null)
                          }}
                          className={`flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] ${
                            selectedEmail?.toLowerCase() === profile.email.toLowerCase()
                              ? 'bg-white/[0.04]'
                              : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{profile.name}</p>
                            <p className="truncate text-xs text-ink-muted">{profile.email}</p>
                            <p className="mt-1 truncate text-xs text-ink-faint">
                              {profile.location || 'No location'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusBadge status={profile.submissions[0].status} />
                            <p className="mt-2 font-mono text-[10px] text-ink-faint">
                              {profile.submissions.length}{' '}
                              {profile.submissions.length === 1 ? 'application' : 'applications'}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div>
                {selectedProfile ? (
                  <PersonProfilePanel
                    profile={selectedProfile}
                    selectedRef={selectedRef}
                    onSelectApplication={loadDetail}
                    selectedDetail={selectedDetail}
                    onUpdated={updated => {
                      setSelectedDetail(updated)
                      setSubmissions(prev =>
                        prev.map(item =>
                          item.referenceId === updated.referenceId
                            ? { ...item, status: updated.status, adminNotes: updated.adminNotes }
                            : item,
                        ),
                      )
                    }}
                    onUnauthorized={handleUnauthorized}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-panel-border bg-panel-surface/20 p-10 text-center text-sm text-ink-muted">
                    Select a person to view their profile and applications.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
