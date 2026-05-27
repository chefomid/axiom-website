import { Component } from 'react'

export default class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Map error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-command-critical">
            Map failed to load
          </p>
          <p className="max-w-md font-mono text-[10px] leading-relaxed text-ink-muted">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded border border-[#444] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white hover:border-command-cyber"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
