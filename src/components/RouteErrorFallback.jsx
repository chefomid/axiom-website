import { Link, useRouteError } from 'react-router-dom'
import { isChunkLoadError } from '../utils/lazyWithRetry'

export default function RouteErrorFallback({ title = 'Something went wrong' }) {
  const error = useRouteError()
  const message = error?.message ?? 'An unexpected error occurred.'
  const chunkError = isChunkLoadError(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080808] p-8 text-center text-ink-primary">
      <p className="font-display text-lg text-white">{title}</p>
      <p className="max-w-lg font-mono text-[11px] leading-relaxed text-ink-muted">
        {chunkError
          ? 'The app could not load a page module, usually after a dev-server restart or hot reload. Reload the page to fetch the latest code.'
          : message}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-[#444] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition hover:border-white"
        >
          Reload page
        </button>
        <Link
          to="/"
          className="rounded border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-secondary transition hover:text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
