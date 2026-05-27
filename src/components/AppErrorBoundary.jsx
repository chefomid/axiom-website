import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080808] p-8 text-center text-ink-primary">
          <p className="font-display text-lg text-white">Something went wrong</p>
          <p className="max-w-lg font-mono text-[11px] leading-relaxed text-ink-muted">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border border-[#444] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white"
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
